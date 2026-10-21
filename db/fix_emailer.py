# Проще: просто сделать last_send nullable в CREATE TABLE
input_file = r"C:\Users\илья\Downloads\converted_millex.sql"
output_file = r"C:\Users\илья\Desktop\millexxyz\new\millex\db\converted_millex_fixed.sql"

with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Найти определение столбца last_send и сделать его nullable
# Было:  "last_send" timestamp NOT NULL
# Станет:  "last_send" timestamp NULL
content = content.replace(
    '"last_send" timestamp NOT NULL',
    '"last_send" timestamp NULL'
)

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Файл сохранен как: {output_file}')
print('Теперь last_send nullable, импортируйте через pgAdmin')
