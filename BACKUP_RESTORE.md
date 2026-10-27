# Резервное копирование и восстановление Millex в production

Это руководство описывает резервирование PostgreSQL, загруженных файлов, настроек и production-образов Docker на Linux-сервере с Docker Compose.

> Восстановление базы данных и файлов перезаписывает production-данные. Перед восстановлением обязательно прочитайте раздел «Перед восстановлением» и сделайте свежую резервную копию.

## 1. Что сохранять и где это находится

| Данные | Путь / источник | Для чего нужны |
| --- | --- | --- |
| PostgreSQL | Docker volume `pgdata` | Пользователи, заказы, товары и другие данные приложения |
| Загруженные файлы | `/var/lib/millex/uploads` на сервере | Фоны, изображения, видео и другие файлы, которые backend сохраняет в `/app/uploads` |
| Переменные и конфигурация | `~/millex/.env`, `~/millex/backend/.env`, `~/millex/millex-bot/.env`, Compose и nginx-конфиги | Секреты и настройки production |
| Код и Docker-образы | Каталог проекта и локальные образы Docker | Версия приложения, которую нужно запустить после восстановления |
| Резервные копии | `/var/backups/millex` | Локальные копии на сервере |

Compose монтирует `/var/lib/millex/uploads` в backend-контейнер как `/app/uploads`. База данных хранится в именованном volume `pgdata`, поэтому резервировать только папку проекта недостаточно. Архив базы и архив загрузок — отдельные файлы.

Команды ниже предполагают, что проект расположен в `/root/millex`, как в примерах команд сервера. Если это не так, узнайте фактический путь:

```bash
cd ~/millex
pwd -P
```

Запомните выведенный полный путь. Если он отличается от `/root/millex`, замените `PROJECT_DIR` в скрипте ниже на фактический путь.

## 2. Подготовка каталога резервных копий

Создайте каталог, доступный только root:

```bash
sudo mkdir -p /var/backups/millex
sudo chown root:root /var/backups/millex
sudo chmod 700 /var/backups/millex
```

Проверьте путь к проекту и постоянному каталогу загрузок:

```bash
cd /root/millex
test -f docker-compose.yml && echo "Compose найден"
test -d /var/lib/millex/uploads && echo "Каталог загрузок найден"
```

Если вы запускаете команды не от root, укажите правильный путь вместо `/root/millex` и убедитесь, что у пользователя есть права запускать `docker compose`.

## 3. Создание скрипта резервирования

Скрипт создаёт:

- `db-ДАТА.dump` — custom-format дамп PostgreSQL;
- `uploads-ДАТА.tar.gz` — архив загруженных файлов;
- `config-ДАТА.tar.gz` — архив присутствующих env-файлов и конфигурации Compose/nginx.

Он проверяет архив базы и архив файлов после создания, выставляет права `600` на копии и удаляет копии старше 14 дней. Архив конфигурации содержит секреты из `.env`.

Создайте скрипт:

```bash
sudo tee /usr/local/sbin/millex-backup >/dev/null <<'EOF'
#!/bin/sh
set -eu

PROJECT_DIR=/root/millex
BACKUP_DIR=/var/backups/millex
UPLOADS_DIR=/var/lib/millex/uploads
DATE=$(date +%F_%H-%M-%S)

test -f "$PROJECT_DIR/docker-compose.yml"
test -d "$UPLOADS_DIR"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

DB_TMP="$BACKUP_DIR/.db-$DATE.dump.tmp"
UPLOADS_TMP="$BACKUP_DIR/.uploads-$DATE.tar.gz.tmp"
CONFIG_TMP="$BACKUP_DIR/.config-$DATE.tar.gz.tmp"
DB_FILE="$BACKUP_DIR/db-$DATE.dump"
UPLOADS_FILE="$BACKUP_DIR/uploads-$DATE.tar.gz"
CONFIG_FILE="$BACKUP_DIR/config-$DATE.tar.gz"

cd "$PROJECT_DIR"

docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$DB_TMP"
docker compose exec -T db pg_restore --list < "$DB_TMP" > /dev/null

tar -czf "$UPLOADS_TMP" -C "$UPLOADS_DIR" .
tar -tzf "$UPLOADS_TMP" > /dev/null

set --
for file in \
  .env \
  backend/.env \
  millex-bot/.env \
  docker-compose.yml \
  millex.conf \
  millex.market.nginx.conf
do
  if [ -f "$PROJECT_DIR/$file" ]; then
    set -- "$@" "$file"
  fi
done

test "$#" -gt 0
tar -czf "$CONFIG_TMP" -C "$PROJECT_DIR" "$@"
tar -tzf "$CONFIG_TMP" > /dev/null

chmod 600 "$DB_TMP" "$UPLOADS_TMP" "$CONFIG_TMP"
mv "$DB_TMP" "$DB_FILE"
mv "$UPLOADS_TMP" "$UPLOADS_FILE"
mv "$CONFIG_TMP" "$CONFIG_FILE"

find "$BACKUP_DIR" -type f \
  \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' -o -name 'config-*.tar.gz' \) \
  -mtime +14 -delete

echo "Резервная копия создана: $DATE"
EOF

sudo chmod 700 /usr/local/sbin/millex-backup
```

Если каталог проекта не `/root/millex`, измените строку `PROJECT_DIR=/root/millex` в `/usr/local/sbin/millex-backup` на путь, который показала команда `pwd -P`.

## 4. Создание и проверка первой копии

Запустите скрипт вручную:

```bash
sudo /usr/local/sbin/millex-backup
```

Убедитесь, что созданы три файла и они не пустые:

```bash
sudo ls -lh /var/backups/millex
```

Проверка конкретных архивов:

```bash
LATEST_DB=$(sudo ls -1t /var/backups/millex/db-*.dump | head -n 1)
LATEST_UPLOADS=$(sudo ls -1t /var/backups/millex/uploads-*.tar.gz | head -n 1)
LATEST_CONFIG=$(sudo ls -1t /var/backups/millex/config-*.tar.gz | head -n 1)

sudo docker compose -f /root/millex/docker-compose.yml exec -T db \
  pg_restore --list < "$LATEST_DB" > /dev/null \
  && echo "Дамп PostgreSQL читается"

sudo tar -tzf "$LATEST_UPLOADS" | head
sudo tar -tzf "$LATEST_CONFIG"
```

Проверьте и исправьте путь в `-f /root/millex/docker-compose.yml`, если проект расположен в другом каталоге.

## 5. Ежедневный запуск через cron

Добавьте запуск каждый день в 03:00:

```bash
sudo crontab -e
```

Добавьте одну строку:

```cron
0 3 * * * /usr/local/sbin/millex-backup >> /var/log/millex-backup.log 2>&1
```

Проверьте, что задача сохранена:

```bash
sudo crontab -l
```

Проверяйте результат и ошибки:

```bash
sudo tail -n 100 /var/log/millex-backup.log
sudo ls -lh /var/backups/millex
```

Для проверки расписания не ждите до 03:00: запускайте `/usr/local/sbin/millex-backup` вручную. Убедитесь, что на сервере настроен и работает cron:

```bash
sudo systemctl status cron
```

На дистрибутивах, где служба называется `crond`, используйте:

```bash
sudo systemctl status crond
```

## 6. Скопируйте копии за пределы сервера

`/var/backups/millex` находится на том же сервере, что и приложение. Поломка диска или потеря сервера может уничтожить и production, и локальные копии. Регулярно копируйте архивы в отдельное хранилище: другой сервер, объектное хранилище или компьютер администратора. Передавайте их по защищённому каналу.

Скачать архивы на локальный компьютер через `scp` можно с локального компьютера, а не из SSH-сессии сервера:

```bash
scp root@АДРЕС_СЕРВЕРА:/var/backups/millex/db-ДАТА.dump .
scp root@АДРЕС_СЕРВЕРА:/var/backups/millex/uploads-ДАТА.tar.gz .
scp root@АДРЕС_СЕРВЕРА:/var/backups/millex/config-ДАТА.tar.gz .
```

Замените `АДРЕС_СЕРВЕРА` и `ДАТА` реальными значениями. Архив `config-*.tar.gz` содержит секреты: храните его в защищённом месте с ограниченным доступом.

## 7. Что сохранить для возврата именно к предыдущей версии приложения

Дамп PostgreSQL и архив загрузок восстанавливают данные, но **не возвращают старый код приложения**. Чтобы после сбоя запустить ту же production-версию, заранее сохраняйте код или Docker-образы.

### Вариант A: Git-релиз

Перед production-деплоем зафиксируйте код в Git и запишите commit ID:

```bash
cd /root/millex
git rev-parse HEAD
git status --short
```

Список `git status --short` должен быть пустым для полностью зафиксированного релиза. Если есть изменения, выясните, входят ли они в production: незакоммиченные и неотслеживаемые файлы не попадут в Git commit. Не добавляйте `.env` и секреты в Git.

При восстановлении исходников переключитесь на проверенный commit:

```bash
cd /root/millex
git fetch --all --tags
git checkout --detach COMMIT_ID
```

`COMMIT_ID` замените на сохранённый идентификатор релиза. Не выполняйте `git reset --hard` поверх единственной копии нужных файлов. Перед переключением проверьте состояние `git status --short`; env-файлы и production-загрузки должны быть вне перезаписываемого кода или заранее скопированы.

### Вариант B: сохранённые Docker-образы

Перед релизом посмотрите фактические имена образов:

```bash
cd /root/millex
docker compose images
docker image ls
```

Сохраните нужные production-образы в отдельные tar-файлы, подставив существующие `IMAGE:TAG` из вывода `docker image ls`:

```bash
docker image save -o /var/backups/millex/backend-image-ДАТА.tar IMAGE_BACKEND:TAG
docker image save -o /var/backups/millex/bot-image-ДАТА.tar IMAGE_BOT:TAG
```

Если используется `client-bot`, сохраните и его образ. Ограничьте доступ к этим файлам и скопируйте их за пределы сервера.

На новом или восстановленном Docker-хосте загрузите образы:

```bash
docker image load -i /var/backups/millex/backend-image-ДАТА.tar
docker image load -i /var/backups/millex/bot-image-ДАТА.tar
```

Затем из каталога с подходящим `docker-compose.yml` запустите сервисы без пересборки:

```bash
docker compose up -d --no-build backend bot
```

Имена образов в текущем Compose должны совпадать с именами загруженных образов. Если Compose настроен собирать образы через `build:` и не указывает `image:`, надёжнее восстановить соответствующий commit исходников и выполнить проверенную сборку. Не удаляйте старые образы до проверки запуска.

## 8. Перед восстановлением данных

1. Убедитесь, что выбрали нужные файлы одной даты:

   ```bash
   sudo ls -lh /var/backups/millex
   ```

2. Проверьте, что дамп читается:

   ```bash
   sudo docker compose -f /root/millex/docker-compose.yml exec -T db \
     pg_restore --list < /var/backups/millex/db-ДАТА.dump
   ```

3. Проверьте список загрузок в архиве:

   ```bash
   sudo tar -tzf /var/backups/millex/uploads-ДАТА.tar.gz | head -n 30
   ```

4. Сделайте ещё одну копию текущего состояния:

   ```bash
   sudo /usr/local/sbin/millex-backup
   ```

5. Предупредите пользователей о временном обслуживании. На время восстановления остановите сервисы, которые меняют данные:

   ```bash
   cd /root/millex
   sudo docker compose stop backend bot
   ```

Замените `/root/millex` в командах на фактический каталог проекта, если он отличается. Не удаляйте volume `pgdata`: команда `docker compose down -v` удалит volume с базой.

## 9. Восстановление PostgreSQL

> Следующая команда изменяет данные production-базы. Убедитесь, что свежая копия текущей базы создана и выбран правильный файл `db-ДАТА.dump`.

Выполните восстановление:

```bash
cd /root/millex

sudo docker compose exec -T db sh -c \
  'pg_restore --clean --if-exists --no-owner --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < /var/backups/millex/db-ДАТА.dump
```

Замените `ДАТА` на дату выбранной резервной копии. Не удаляйте `pgdata` и не выполняйте `docker compose down -v`.

`--clean --if-exists` удаляет объекты из дампа перед восстановлением. Если команда завершилась с ошибкой, не запускайте приложение поверх частично восстановленной базы: сохраните весь вывод ошибки и обратитесь к администратору базы.

## 10. Восстановление загруженных файлов

Сначала переименуйте текущий каталог загрузок, чтобы сохранить его для возврата:

```bash
sudo mv /var/lib/millex/uploads \
  "/var/lib/millex/uploads.before-restore.$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p /var/lib/millex/uploads
```

Распакуйте выбранный архив:

```bash
sudo tar -xzf /var/backups/millex/uploads-ДАТА.tar.gz \
  -C /var/lib/millex/uploads
```

Проверьте содержимое и права:

```bash
sudo find /var/lib/millex/uploads -maxdepth 2 -type f | head -n 30
sudo ls -ld /var/lib/millex/uploads
```

Не используйте случайный `chown`: владелец должен соответствовать настройкам сервера и контейнера. Если backend не может читать или создавать файлы, сначала проверьте владельца до восстановления:

```bash
docker compose -f /root/millex/docker-compose.yml exec backend id
```

## 11. Восстановление конфигурации

Архив `config-ДАТА.tar.gz` может содержать корневой `.env`, `backend/.env` и `millex-bot/.env`. Это секретные данные. Не распаковывайте архив целиком поверх проекта, не просмотрев его содержимое:

```bash
sudo tar -tzf /var/backups/millex/config-ДАТА.tar.gz
```

Чтобы извлечь конфигурацию во временный каталог:

```bash
sudo mkdir -p /root/millex-config-restore
sudo tar -xzf /var/backups/millex/config-ДАТА.tar.gz \
  -C /root/millex-config-restore
sudo find /root/millex-config-restore -type f -maxdepth 3 -print
```

Сравните нужные env-файлы с текущими и переносите только те, которые действительно требуется восстановить. Например:

```bash
sudo diff -u /root/millex/backend/.env \
  /root/millex-config-restore/backend/.env
```

`diff` может показать секретные значения — не отправляйте такой вывод в чат или тикет. Чтобы заменить конфигурацию, сначала сохраните текущую:

```bash
sudo cp -a /root/millex/backend/.env \
  "/root/millex/backend/.env.before-restore.$(date +%Y%m%d-%H%M%S)"
sudo install -o root -g root -m 600 \
  /root/millex-config-restore/backend/.env \
  /root/millex/backend/.env
```

Повторите замену для других env-файлов только при необходимости и после сравнения. **Не заменяйте `docker-compose.yml` или nginx-конфиг автоматически**, если в текущем production они отличаются от архива: сначала изучите изменения и сохраните копии.

## 12. Запуск production после восстановления

Убедитесь, что вы находитесь в правильном каталоге проекта и конфигурация Compose корректна:

```bash
cd /root/millex
sudo docker compose config -q
```

Запустите production-сервисы без сборки образов:

```bash
sudo docker compose up -d --no-build db redis backend bot client-bot
```

Если сервис `client-bot` не используется в этой установке, уберите `client-bot` из команды. Если нужного образа нет, Compose не сможет запустить соответствующий сервис: восстановите образ из image-архива или исходники нужного релиза и выполните сборку только после проверки логов сборки.

Проверьте состояние:

```bash
sudo docker compose ps
sudo docker compose logs --since=5m --tail=100 backend
sudo docker compose logs --since=5m --tail=100 bot
```

Проверьте API на сервере:

```bash
curl -i http://127.0.0.1:8000/api/health
```

Затем проверьте внешний адрес:

```bash
curl -i https://millex.market/api/health
```

Ожидается HTTP `200`. Если health-check не проходит, не выполняйте повторные восстановления наугад. Сохраните вывод `docker compose ps` и свежие логи backend; удалите из логов секреты перед передачей.

## 13. Частые команды для обслуживания

```bash
# Создать резервную копию вручную
sudo /usr/local/sbin/millex-backup

# Показать имеющиеся копии
sudo ls -lh /var/backups/millex

# Посмотреть журнал cron-задачи
sudo tail -n 100 /var/log/millex-backup.log

# Посмотреть расписание root
sudo crontab -l

# Проверить Docker Compose-сервисы
cd /root/millex && sudo docker compose ps

# Проверить свободное место
df -h /var/backups /var/lib/millex
```

## 14. Правила безопасности и надёжности

- Не публикуйте `.env`, дампы базы, архивы конфигурации, токены и пароли.
- Ограничьте доступ к `/var/backups/millex`; архивы конфигурации содержат секреты.
- Храните хотя бы одну копию вне production-сервера и периодически проверяйте её восстановлением на отдельной тестовой среде.
- Не считайте архив проверенным только потому, что файл появился: проверяйте список дампа и содержимое tar-архивов.
- Не удаляйте Docker volume `pgdata` при штатном перезапуске или восстановлении.
- Перед восстановлением базы и загрузок сделайте копию текущих данных и проверьте дату целевой копии.
- Восстановление базы, файлов и кода из одной даты уменьшает риск несовпадения ссылок на файлы и записей в базе.
- Скрипт хранит 14 дней локальных резервных копий. Внешнее хранилище должно иметь собственный срок хранения и контроль доступа.
