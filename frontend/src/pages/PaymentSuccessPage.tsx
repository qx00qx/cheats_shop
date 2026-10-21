import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function PaymentSuccessPage() {
  return (
    <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
      <Seo title="Оплата прошла" noIndex />
      <h1 className="page-title">✅ Оплата прошла</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Заказ активирован. Загляните в личный кабинет.
      </p>
      <Link to="/profile" className="btn-primary">
        Личный кабинет
      </Link>
    </div>
  );
}