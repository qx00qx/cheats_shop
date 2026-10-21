import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function PaymentFailPage() {
  return (
    <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
      <Seo title="Оплата не прошла" noIndex />
      <h1 className="page-title">❌ Оплата не прошла</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Попробуйте ещё раз или выберите другой способ оплаты.
      </p>
      <Link to="/catalog" className="btn-primary">
        Назад в каталог
      </Link>
    </div>
  );
}