import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

type Tariff = {
  id: number;
  title: string;
  price: number;
  cost_amount: number | null;
};

type AccountingItem = {
  id: number;
  name: string;
  alias: string;
  tariffs: Tariff[];
};

type AccountingSettings = {
  management_commission_percent: number;
  items: AccountingItem[];
};

type AccountingEntry = {
  id: number;
  type: string;
  product_name: string | null;
  payment_method: string | null;
  turnover_amount: number;
  sale_amount: number;
  cost_amount: number | null;
  commission_amount: number;
  profit_amount: number | null;
  created_at: string | null;
};

type AccountingExpense = {
  id: number;
  amount: number;
  occurred_at: string;
  category: string;
  description: string;
};

type AccountingSummary = {
  totals: {
    turnover: number;
    sales: number;
    costs: number;
    commissions: number;
    gross_profit: number | null;
    expenses: number;
    net_profit: number | null;
    sales_missing_cost_count: number;
  };
  entries: AccountingEntry[];
  expenses_list: AccountingExpense[];
};

const money = (value: number | null) =>
  value === null ? "Не рассчитано" : `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₽`;

const entryLabels: Record<string, string> = {
  topup_credit: "Пополнение баланса",
  topup_chargeback: "Возврат пополнения",
  sale: "Продажа",
  sale_chargeback: "Возврат продажи",
};

function localDateTimeNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function AdminAccounting() {
  const [settings, setSettings] = useState<AccountingSettings>({
    management_commission_percent: 0,
    items: [],
  });
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [commissionDraft, setCommissionDraft] = useState("0");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedTariffId, setSelectedTariffId] = useState("");
  const [costDraft, setCostDraft] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(localDateTimeNow);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedItem = settings.items.find(
    (item) => String(item.id) === selectedItemId,
  );
  const selectedTariff = selectedItem?.tariffs.find(
    (tariff) => String(tariff.id) === selectedTariffId,
  );

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };
      const [settingsResponse, summaryResponse] = await Promise.all([
        api.get<AccountingSettings>("/admin/accounting/settings"),
        api.get<AccountingSummary>("/admin/accounting/summary", { params }),
      ]);
      setSettings(settingsResponse.data);
      setCommissionDraft(String(settingsResponse.data.management_commission_percent));
      setSummary(summaryResponse.data);
    } catch (loadError) {
      console.error("Failed to load accounting data:", loadError);
      setError("Не удалось загрузить бухгалтерию. Проверьте доступ и соединение с сервером.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    setSelectedTariffId("");
    setCostDraft("");
  }, [selectedItemId]);

  useEffect(() => {
    setCostDraft(
      selectedTariff?.cost_amount == null
        ? ""
        : String(selectedTariff.cost_amount),
    );
  }, [selectedTariffId, selectedTariff?.cost_amount]);

  const totals = summary?.totals;
  const financialCards = useMemo(() => [
    ["Оборот", totals ? money(totals.turnover) : "—"],
    ["Продажи", totals ? money(totals.sales) : "—"],
    ["Себестоимость", totals ? money(totals.costs) : "—"],
    ["Комиссия руководства", totals ? money(totals.commissions) : "—"],
    ["Прибыль до расходов", totals ? money(totals.gross_profit) : "—"],
    ["Расходы", totals ? money(totals.expenses) : "—"],
    ["Прибыль после расходов", totals ? money(totals.net_profit) : "—"],
  ], [totals]);

  const saveCommission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(commissionDraft);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Комиссия должна быть числом от 0 до 100 процентов.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put("/admin/accounting/commission", {
        management_commission_percent: value,
      });
      setNotice("Комиссия сохранена. Новое значение применяется к следующим заказам.");
      await loadData();
    } catch (saveError) {
      console.error("Failed to save accounting commission:", saveError);
      setError("Не удалось сохранить комиссию.");
    } finally {
      setSaving(false);
    }
  };

  const saveCost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(costDraft);
    if (!selectedItem || !selectedTariff || !Number.isFinite(value) || value < 0) {
      setError("Выберите товар и тариф и укажите неотрицательную себестоимость.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put("/admin/accounting/item-cost", {
        item_id: selectedItem.id,
        tariff_id: selectedTariff.id,
        cost_amount: value,
      });
      setNotice("Себестоимость тарифа сохранена. Новое значение применяется к следующим заказам.");
      await loadData();
    } catch (saveError) {
      console.error("Failed to save accounting item cost:", saveError);
      setError("Не удалось сохранить себестоимость.");
    } finally {
      setSaving(false);
    }
  };

  const createExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !expenseDate) {
      setError("Укажите положительную сумму и дату расхода.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.post("/admin/accounting/expenses", {
        amount,
        occurred_at: new Date(expenseDate).toISOString(),
        category: expenseCategory.trim() || "Прочее",
        description: expenseDescription.trim(),
      });
      setExpenseAmount("");
      setExpenseCategory("");
      setExpenseDescription("");
      setNotice("Расход добавлен.");
      await loadData();
    } catch (saveError) {
      console.error("Failed to create accounting expense:", saveError);
      setError("Не удалось добавить расход.");
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU");
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px 12px",
    color: "#fff",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
  };

  return (
    <div>
      <h1 className="page-title">Бухгалтерия</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Учитываются подтверждённые пополнения баланса и покупки читов через каталог.
        Себестоимость и комиссия фиксируются в заказе при его создании.
      </p>

      {error && <p role="alert" style={{ color: "#ff8585" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#85dfa0" }}>{notice}</p>}

      <section style={{ marginBottom: 24 }}>
        <h2>Период отчёта</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>
            С
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
          </label>
          <label>
            По
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
          </label>
          <button type="button" className="btn-ghost" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Весь период
          </button>
        </div>
      </section>

      {loading ? <p>Загрузка бухгалтерии…</p> : (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}>
            {financialCards.map(([label, value]) => (
              <div key={label} className="card" style={{ padding: 16 }}>
                <div className="muted">{label}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          {totals && totals.sales_missing_cost_count > 0 && (
            <p role="alert" className="muted">
              Для {totals.sales_missing_cost_count} продаж не задана себестоимость;
              прибыль показана как «Не рассчитано», пока не будет добавлена стоимость тарифа.
            </p>
          )}

          <section style={{ marginBottom: 28 }}>
            <h2>Настройки расчёта</h2>
            <form onSubmit={saveCommission} style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
              <label>
                Комиссия руководства, %
                <input type="number" min="0" max="100" step="0.001" required value={commissionDraft} onChange={(event) => setCommissionDraft(event.target.value)} style={inputStyle} />
              </label>
              <button className="btn-ghost" disabled={saving}>Сохранить комиссию</button>
            </form>

            <form onSubmit={saveCost} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
              <label>
                Товар
                <select required value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} style={inputStyle}>
                  <option value="">Выберите товар</option>
                  {settings.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name || item.alias}</option>
                  ))}
                </select>
              </label>
              <label>
                Тариф
                <select required value={selectedTariffId} onChange={(event) => setSelectedTariffId(event.target.value)} style={inputStyle}>
                  <option value="">Выберите тариф</option>
                  {selectedItem?.tariffs.map((tariff) => (
                    <option key={tariff.id} value={tariff.id}>{tariff.title}</option>
                  ))}
                </select>
              </label>
              <label>
                Себестоимость, ₽
                <input type="number" min="0" step="0.01" required value={costDraft} onChange={(event) => setCostDraft(event.target.value)} style={inputStyle} />
              </label>
              <button className="btn-ghost" disabled={saving || !selectedTariff}>Сохранить себестоимость</button>
            </form>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2>Добавить расход</h2>
            <form onSubmit={createExpense} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
              <label>
                Сумма, ₽
                <input type="number" min="0.01" step="0.01" required value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} style={inputStyle} />
              </label>
              <label>
                Дата
                <input type="datetime-local" required value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} style={inputStyle} />
              </label>
              <label>
                Категория
                <input maxLength={64} value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} placeholder="Например, реклама" style={inputStyle} />
              </label>
              <label>
                Комментарий
                <input required maxLength={2000} value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} style={inputStyle} />
              </label>
              <button className="btn-ghost" disabled={saving}>Добавить расход</button>
            </form>
          </section>

          <section style={{ overflowX: "auto", marginBottom: 28 }}>
            <h2>Последние 100 проводок</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead><tr>
                <th align="left">Дата</th><th align="left">Операция</th><th align="left">Товар</th>
                <th align="left">Оплата</th><th align="right">Оборот</th><th align="right">Продажа</th><th align="right">Себестоимость</th>
                <th align="right">Комиссия</th><th align="right">Прибыль</th>
              </tr></thead>
              <tbody>
                {summary?.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{dateLabel(entry.created_at)}</td>
                    <td>{entryLabels[entry.type] || entry.type}</td>
                    <td>{entry.product_name || "—"}</td>
                    <td>{entry.payment_method || "—"}</td>
                    <td align="right">{money(entry.turnover_amount)}</td>
                    <td align="right">{money(entry.sale_amount)}</td>
                    <td align="right">{money(entry.cost_amount)}</td>
                    <td align="right">{money(entry.commission_amount)}</td>
                    <td align="right">{money(entry.profit_amount)}</td>
                  </tr>
                ))}
                {!summary?.entries.length && <tr><td colSpan={9}>За выбранный период операций нет.</td></tr>}
              </tbody>
            </table>
          </section>

          <section style={{ overflowX: "auto" }}>
            <h2>Расходы</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead><tr>
                <th align="left">Дата</th><th align="left">Категория</th>
                <th align="left">Описание</th><th align="right">Сумма</th>
              </tr></thead>
              <tbody>
                {summary?.expenses_list.map((expense) => (
                  <tr key={expense.id}>
                    <td>{dateLabel(expense.occurred_at)}</td>
                    <td>{expense.category}</td>
                    <td>{expense.description}</td>
                    <td align="right">{money(expense.amount)}</td>
                  </tr>
                ))}
                {!summary?.expenses_list.length && <tr><td colSpan={4}>За выбранный период расходов нет.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
