export type PaymentMethod = "card" | "sbp" | "crypto" | "balance";

const LABELS: Record<PaymentMethod, { icon: string; name: string }> = {
  card: { icon: "💳", name: "Карта" },
  sbp: { icon: "⚡", name: "СБП" },
  crypto: { icon: "₿", name: "Крипта" },
  balance: { icon: "👛", name: "Баланс" },
};

export default function PaymentMethodSelector({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  const methods: PaymentMethod[] = ["card", "sbp", "crypto", "balance"];

  return (
    <div className="payment-methods">
      {methods.map((m) => (
        <label
          key={m}
          className={`payment-method ${value === m ? "active" : ""}`}
        >
          <input
            type="radio"
            name="method"
            checked={value === m}
            onChange={() => onChange(m)}
          />
          <div>
            <div className="method-icon">{LABELS[m].icon}</div>
            <div className="method-info">
              <div className="method-name">{LABELS[m].name}</div>
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}