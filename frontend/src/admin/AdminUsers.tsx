import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type AdminUser = {
  id: number;
  email: string | null;
  username: string | null;
  balance: number;
  discount_percent: number;
  is_admin: boolean;
  is_active: boolean;
  created_at: string | null;
};

type AdminUsersResponse = {
  items?: AdminUser[];
  users?: AdminUser[];
  total?: number;
};

const PAGE_SIZE = 50;

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingBalanceUserId, setEditingBalanceUserId] = useState<number | null>(null);
  const [balanceDraft, setBalanceDraft] = useState("");
  const [savingBalanceUserId, setSavingBalanceUserId] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [editingDiscountUserId, setEditingDiscountUserId] = useState<number | null>(null);
  const [discountDraft, setDiscountDraft] = useState("");
  const [savingDiscountUserId, setSavingDiscountUserId] = useState<number | null>(null);
  const [discountError, setDiscountError] = useState("");

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get<AdminUsersResponse | AdminUser[]>(
          "/auth/users",
          {
            params: {
              limit: PAGE_SIZE,
              offset: page * PAGE_SIZE,
              q: appliedSearch || undefined,
            },
          },
        );

        const payload = response.data;
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.items)
            ? payload.items
            : Array.isArray(payload.users)
              ? payload.users
              : [];

        const responseTotal = Array.isArray(payload)
          ? payload.length
          : typeof payload.total === "number"
            ? payload.total
            : items.length;

        if (active) {
          setUsers(items);
          setTotal(responseTotal);
        }
      } catch (loadError) {
        console.error("Failed to load admin users:", loadError);
        if (active) {
          setUsers([]);
          setTotal(0);
          setError("Не удалось загрузить пользователей. Проверьте доступ и попробуйте снова.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUsers();

    return () => {
      active = false;
    };
  }, [appliedSearch, page]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    setAppliedSearch(search.trim());
  };

  const saveBalance = async (userId: number) => {
    const balance = Number(balanceDraft);
    if (!Number.isFinite(balance) || balance < 0 || !/^\d+(?:\.\d{1,2})?$/.test(balanceDraft.trim())) {
      setBalanceError("Введите неотрицательный баланс с точностью до двух знаков после запятой.");
      return;
    }

    setSavingBalanceUserId(userId);
    setBalanceError("");
    try {
      const response = await api.patch<{ id: number; balance: number }>(
        `/admin/users/${userId}/balance`,
        { balance },
      );
      setUsers((current) => current.map((user) =>
        user.id === response.data.id
          ? { ...user, balance: response.data.balance }
          : user,
      ));
      setEditingBalanceUserId(null);
    } catch (saveError: any) {
      console.error("Failed to update user balance:", saveError);
      setBalanceError(
        saveError?.response?.data?.detail ??
        "Не удалось изменить баланс. Проверьте доступ и повторите попытку.",
      );
    } finally {
      setSavingBalanceUserId(null);
    }
  };

  const saveDiscount = async (userId: number) => {
    const discount = Number(discountDraft);
    if (!Number.isInteger(discount) || discount < 0 || discount > 10) {
      setDiscountError("Введите целое значение скидки от 0 до 10%.");
      return;
    }

    setSavingDiscountUserId(userId);
    setDiscountError("");
    try {
      const response = await api.patch<{ id: number; discount_percent: number }>(
        `/admin/users/${userId}/discount`,
        { discount_percent: discount },
      );
      setUsers((current) => current.map((user) =>
        user.id === response.data.id
          ? { ...user, discount_percent: response.data.discount_percent }
          : user,
      ));
      setEditingDiscountUserId(null);
    } catch (saveError: any) {
      console.error("Failed to update user loyalty discount:", saveError);
      setDiscountError(
        saveError?.response?.data?.detail ??
        "Не удалось изменить скидку. Проверьте доступ и повторите попытку.",
      );
    } finally {
      setSavingDiscountUserId(null);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU");
  };

  return (
    <div>
      <h1 className="page-title">Пользователи</h1>

      <p className="muted" style={{ marginBottom: 16 }}>
        Всего пользователей: {total}
      </p>

      <form
        onSubmit={handleSearch}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          aria-label="Поиск пользователей"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по email или имени пользователя"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
            color: "#fff",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
          }}
        />
        <button type="submit" className="btn-ghost">
          Найти
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>
          {error}
        </p>
      )}
      {balanceError && (
        <p role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>
          {balanceError}
        </p>
      )}
      {discountError && (
        <p role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>
          {discountError}
        </p>
      )}

      <div
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                textAlign: "left",
              }}
            >
              {["ID", "Email", "Имя пользователя", "Баланс", "Накопительная скидка", "Статус", "Регистрация"].map(
                (heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "12px 16px",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center" }}>
                  Загрузка...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  {error ? "Список недоступен" : "Пользователи не найдены"}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <td style={{ padding: "12px 16px" }}>{user.id}</td>
                  <td style={{ padding: "12px 16px" }}>{user.email || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{user.username || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {editingBalanceUserId === user.id ? (
                      <form
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveBalance(user.id);
                        }}
                      >
                        <input
                          aria-label={`Новый баланс пользователя ${user.email || user.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={balanceDraft}
                          onChange={(event) => setBalanceDraft(event.target.value)}
                          style={{
                            width: 110,
                            padding: "7px 8px",
                            color: "#fff",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 6,
                          }}
                        />
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={savingBalanceUserId === user.id}
                          aria-label="Сохранить баланс"
                        >
                          {savingBalanceUserId === user.id ? "…" : "✓"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={savingBalanceUserId === user.id}
                          aria-label="Отменить изменение баланса"
                          onClick={() => {
                            setEditingBalanceUserId(null);
                            setBalanceError("");
                          }}
                        >
                          ×
                        </button>
                      </form>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{user.balance ?? 0} ₽</span>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: "5px 8px", fontSize: 12 }}
                          aria-label={`Изменить баланс пользователя ${user.email || user.id}`}
                          onClick={() => {
                            setEditingBalanceUserId(user.id);
                            setBalanceDraft(Number(user.balance ?? 0).toFixed(2));
                            setBalanceError("");
                          }}
                        >
                          Изменить
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {editingDiscountUserId === user.id ? (
                      <form
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveDiscount(user.id);
                        }}
                      >
                        <input
                          aria-label={`Накопительная скидка пользователя ${user.email || user.id}`}
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={discountDraft}
                          onChange={(event) => setDiscountDraft(event.target.value)}
                          style={{
                            width: 64,
                            padding: "7px 8px",
                            color: "#fff",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 6,
                          }}
                        />
                        <span>%</span>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={savingDiscountUserId === user.id}
                          aria-label="Сохранить накопительную скидку"
                        >
                          {savingDiscountUserId === user.id ? "…" : "✓"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={savingDiscountUserId === user.id}
                          aria-label="Отменить изменение скидки"
                          onClick={() => {
                            setEditingDiscountUserId(null);
                            setDiscountError("");
                          }}
                        >
                          ×
                        </button>
                      </form>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{user.discount_percent ?? 0}%</span>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: "5px 8px", fontSize: 12 }}
                          aria-label={`Изменить накопительную скидку пользователя ${user.email || user.id}`}
                          onClick={() => {
                            setEditingDiscountUserId(user.id);
                            setDiscountDraft(String(user.discount_percent ?? 0));
                            setDiscountError("");
                          }}
                        >
                          Изменить
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {user.is_admin
                      ? "Администратор"
                      : user.is_active
                        ? "Активен"
                        : "Неактивен"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {formatDate(user.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <button
          type="button"
          className="btn-ghost"
          disabled={page === 0 || loading}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          Назад
        </button>

        <span className="muted">
          Страница {page + 1} · Показано {users.length} из {total}
        </span>

        <button
          type="button"
          className="btn-ghost"
          disabled={(page + 1) * PAGE_SIZE >= total || loading}
          onClick={() => setPage((current) => current + 1)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}