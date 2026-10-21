from aiogram import Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from aiogram_dialog import Dialog, DialogManager, StartMode, Window
from aiogram_dialog.widgets.input import TextInput
from aiogram_dialog.widgets.kbd import Back, Button, Cancel, SwitchTo
from aiogram_dialog.widgets.text import Const, Format

from app.config import settings
from app.db import SessionMaker
from app.repositories.promo_keys import (
    add_promo_key,
    get_keys_stats,
    list_recent_keys,
)
from app.states.admin import AdminSG

router = Router()


def is_admin(user_id: int) -> bool:
    return user_id in settings.admin_id_set


@router.message(Command("admin"))
async def cmd_admin(message: Message, dialog_manager: DialogManager):
    if not is_admin(message.from_user.id):
        await message.answer("⛔ Доступ только для админов.")
        return

    await dialog_manager.start(AdminSG.menu, mode=StartMode.RESET_STACK)


@router.message(Command("start"))
async def cmd_start(message: Message):
    if is_admin(message.from_user.id):
        await message.answer(
            "Привет! Это бот для управления ключами.\n"
            "Открой панель: /admin"
        )
    else:
        await message.answer("Бот доступен только для админов.")


async def menu_getter(dialog_manager: DialogManager, **kwargs):
    async with SessionMaker() as session:
        stats = await get_keys_stats(session)

    return {
        "total_keys": stats.total,
        "free_keys": stats.free,
        "used_keys": stats.used,
    }


async def add_key_getter(dialog_manager: DialogManager, **kwargs):
    return {
        "item_alias": dialog_manager.dialog_data.get("item_alias", ""),
    }


async def on_item_alias(
    message: Message,
    widget: TextInput,
    dialog_manager: DialogManager,
    value: str,
):
    value = value.strip()
    if not value:
        await message.answer("Alias не может быть пустым.")
        return

    dialog_manager.dialog_data["item_alias"] = value
    await dialog_manager.switch_to(AdminSG.add_key_value)


async def on_key_value(
    message: Message,
    widget: TextInput,
    dialog_manager: DialogManager,
    value: str,
):
    key_value = value.strip()
    item_alias = dialog_manager.dialog_data.get("item_alias")

    if not item_alias:
        await message.answer("Сначала укажи alias товара.")
        await dialog_manager.switch_to(AdminSG.add_item_alias)
        return

    try:
        async with SessionMaker() as session:
            obj = await add_promo_key(
                session,
                item_alias=item_alias,
                key_value=key_value,
                added_by_tg_id=message.from_user.id,
            )
    except ValueError:
        await message.answer("⛔ Такой ключ уже существует.")
        return

    await message.answer(
        f"✅ Ключ добавлен\n"
        f"<b>Товар:</b> {obj.item_alias}\n"
        f"<b>Ключ:</b> <code>{obj.key_value}</code>"
    )

    dialog_manager.dialog_data.clear()
    await dialog_manager.switch_to(AdminSG.menu)


async def on_recent_keys(
    callback: CallbackQuery,
    button: Button,
    dialog_manager: DialogManager,
):
    async with SessionMaker() as session:
        keys = await list_recent_keys(session, limit=10)

    if not keys:
        await callback.message.answer("Пока ключей нет.")
        await callback.answer()
        return

    lines = ["📦 Последние ключи:\n"]
    for key in keys:
        status = "🟢 free" if key.status == "free" else "🔴 used"
        lines.append(
            f"{key.id}. "
            f"[{key.item_alias}] "
            f"{status} — <code>{key.key_value}</code>"
        )

    await callback.message.answer("\n".join(lines))
    await callback.answer()


admin_dialog = Dialog(
    Window(
        Format(
            "🛠 <b>Админ-панель</b>\n\n"
            "Всего ключей: <b>{total_keys}</b>\n"
            "Свободно: <b>{free_keys}</b>\n"
            "Использовано: <b>{used_keys}</b>"
        ),
        SwitchTo(
            Const("➕ Добавить ключ"),
            id="to_add_key",
            state=AdminSG.add_item_alias,
        ),
        Button(
            Const("Последние ключи"),
            id="recent_keys",
            on_click=on_recent_keys,
        ),
        Cancel(Const("Закрыть")),
        state=AdminSG.menu,
        getter=menu_getter,
    ),
    Window(
        Const(
            "Шаг 1/2\n\n"
            "Отправь <b>alias товара</b>.\n"
            "Пример: <code>manual-mason-eft</code>"
        ),
        TextInput(id="item_alias", on_success=on_item_alias),
        Back(Const("Назад")),
        Cancel(Const("Закрыть")),
        state=AdminSG.add_item_alias,
    ),
    Window(
        Format(
            "Шаг 2/2\n\n"
            "Товар: <b>{item_alias}</b>\n"
            "Теперь отправь <b>сам ключ</b>."
        ),
        TextInput(id="key_value", on_success=on_key_value),
        Back(Const("Назад")),
        Cancel(Const("Закрыть")),
        state=AdminSG.add_key_value,
        getter=add_key_getter,
    ),
)