import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function NotFoundPage() {
  return (
    <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
      <Seo title="Страница не найдена" noIndex />
      <h1 className="newhome-hero-title">Раздел в разработке</h1>
      <Link to="/" className="btn-on-main btn-primary">
        На главную
      </Link>
    </div>
  );
}