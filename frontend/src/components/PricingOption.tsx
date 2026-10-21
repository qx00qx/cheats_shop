import { Plan } from "../api/products";

export default function PricingOption({
  plan,
  active,
  onSelect,
}: {
  plan: Plan;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`pricing-option ${active ? "active" : ""}`}>
      <input type="radio" name="plan" checked={active} onChange={onSelect} />
      <div className="option-content">
        <span className="option-label">{plan.label}</span>
        <span className="option-price">
          {plan.old_price && <span className="price-old">{plan.old_price} ₽</span>}
          <span className="price-current">{plan.price} ₽</span>
          {plan.discount_badge && <span className="price-badge">{plan.discount_badge}</span>}
        </span>
      </div>
    </label>
  );
}