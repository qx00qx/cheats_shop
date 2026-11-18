import Seo from "../components/Seo";
import { SeoHeading, SeoTextBlock } from "../components/SeoPageContent";

export default function CookiePage() {
  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
      <Seo
        pageKey="cookie"
        title="Политика использования cookie"
        description="Информация об использовании файлов cookie на сайте MILLEX."
      />
      <SeoHeading
        pageKey="cookie"
        className="page-title"
        fallback="Использование Cookie"
      />
      <p className="muted">
        Мы используем cookie для работы сайта и аналитики. Продолжая пользоваться сайтом, вы
        соглашаетесь с этим.
      </p>
      <SeoTextBlock pageKey="cookie" />
    </div>
  );
}