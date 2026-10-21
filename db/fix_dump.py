import re

input_file = r"C:\Users\илья\Downloads\converted_millex.sql"
output_file = r"C:\Users\илья\Desktop\millexxyz\new\millex\db\millex_fixed.sql"

print(f"Чтение файла: {input_file}")
with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

print("Исправление ошибок...")

# 1. Сделать last_send nullable
content = content.replace(
    '"last_send" timestamp NOT NULL',
    '"last_send" timestamp NULL'
)

# 2. Исправить неполные COALESCE для setval
pattern1 = r'SELECT setval\("([^"]+)",\s*COALESCE\(MAX\("id"\),\s*0\)\)\s*FROM\s*"([^"]+");'
replacement1 = r'SELECT setval("\1", COALESCE(MAX("id"), 0), 0) FROM "\2";'
content = re.sub(pattern1, replacement1, content)

# 3. Убрать psql-команды
content = re.sub(r'\\set\s+\S+\s+on', '', content, flags=re.IGNORECASE)
content = re.sub(r'\\set\s+\S+\s+off', '', content, flags=re.IGNORECASE)

# 4. Добавить команды для очистки БД в начало
cleanup_commands = """-- Очистить существующую базу
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO millex;
GRANT ALL ON SCHEMA public TO public;

"""

content = cleanup_commands + content

print(f"Сохранение в: {output_file}")
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Готово! Исправленный файл: millex_fixed.sql")
print("Теперь содержит команды для очистки БД и полного импорта дампа")
print("Импортируйте через pgAdmin Query Tool")
