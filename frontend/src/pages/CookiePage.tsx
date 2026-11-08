import Seo from "../components/Seo";

export default function CookiePage() {
  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
      <Seo
        pageKey="cookie"
        title="Политика использования cookie"
        description="Информация об использовании файлов cookie на сайте MILLEX."
      />
      <h1 className="page-title">Использование Cookie</h1>
      <p className="muted">
        Мы используем cookie для работы сайта и аналитики. Продолжая пользоваться сайтом, вы
        соглашаетесь с этим.
      </p>
    </div>
  );
}