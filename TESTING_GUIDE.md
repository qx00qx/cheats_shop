# Как протестировать регистрацию и ЛК с PostgreSQL

## Шаг 1: Запустить PostgreSQL и Redis локально

Используйте отдельный docker-compose файл только для БД:

```bash
cd new/millex
docker-compose -f DOCKER_LOCAL_DB.yml up -d
```

Это запустит:
- PostgreSQL на порту 5432
- Redis на порту 6379

Проверьте, что контейнеры запущены:
```bash
docker ps
```

Должны видеть:
```
postgres:16-alpine (millex-db-1)
redis:7-alpine (millex-redis-1)
```

## Шаг 2: Запустить бэкенд

```bash
cd new/millex/backend
.venv/Scripts/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Бэкенд должен запуститься успешно и создать таблицы в PostgreSQL.

Проверьте health endpoint:
```bash
curl http://localhost:8000/api/health
```

Ответ:
```json
{
  "status": "ok",
  "app": "Millex"
}
```

## Шаг 3: Запустить фронтенд

```bash
cd new/millex/frontend
npm run dev
```

Фронтенд запустится на http://localhost:5173

## Шаг 4: Протестировать регистрацию через UI

1. Откройте http://localhost:5173/register
2. Заполните форму:
   - Email: `test@example.com`
   - Никнейм: `testuser`
   - Пароль: `test123456` (минимум 8 символов)
3. Нажмите "Создать аккаунт"
4. После успешной регистрации вы будете перенаправлены на главную страницу

## Шаг 5: Протестировать авторизацию через UI

1. Откройте http://localhost:5173/login
2. Введите email и пароль
3. Нажмите "Войти"
4. После успешного входа вы будете перенаправлены на главную страницу

## Шаг 6: Протестировать ЛК

1. После авторизации перейдите на http://localhost:5173/profile/balance
2. Должна открыться страница пополнения баланса с дизайном из старого проекта
3. Вы увидите:
   - Боковое меню навигации
   - Блоки с балансом RUB и USD
   - Переключатель валюты
   - Способы оплаты
   - Историю пополнений (mock данные)

## Шаг 7: Протестировать API напрямую (опционально)

### Регистрация через API:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@example.com",
    "username": "apitest",
    "password": "test123456"
  }'
```

Ответ:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "email": "apitest@example.com",
    "username": "apitest"
  }
}
```

### Авторизация через API:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@example.com",
    "password": "test123456"
  }'
```

### Получить текущего пользователя:

```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

## Шаг 8: Проверить базу данных

Подключитесь к PostgreSQL:

```bash
docker exec -it millex-db-1 psql -U millex -d millex
```

Посмотреть таблицы:
```sql
\dt
```

Посмотреть пользователей:
```sql
SELECT id, email, username FROM users;
```

Выход:
```sql
\q
```

## Остановка

Остановить БД и Redis:
```bash
cd new/millex
docker-compose -f DOCKER_LOCAL_DB.yml down
```

Удалить данные БД:
```bash
docker-compose -f DOCKER_LOCAL_DB.yml down -v
```

## Частые проблемы

### Бэкенд не может подключиться к PostgreSQL

Убедитесь, что контейнер PostgreSQL запущен:
```bash
docker ps
```

Проверьте логи:
```bash
docker logs millex-db-1
```

### Порт 5432 уже занят

Если у вас уже есть PostgreSQL на порту 5432, измените порт в DOCKER_LOCAL_DB.yml:
```yaml
ports:
  - "5433:5432"
```

И измените DATABASE_URL в .env:
```
DATABASE_URL=postgresql://millex:millex_secret@localhost:5433/millex
```

### Бэкенд не запускается

Проверьте, что все зависимости установлены:
```bash
cd new/millex/backend
.venv/Scripts/pip install -r requirements.txt
```

## Схема БД

После первого запуска бэкенда будут созданы следующие таблицы:

- `users` - пользователи
- `games` - игры
- `categories` - категории
- `products` - товары
- `product_plans` - планы продуктов
- `orders` - заказы
- `balance_audit` - аудит баланса
