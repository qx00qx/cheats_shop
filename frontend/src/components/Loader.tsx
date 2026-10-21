export default function Loader({ text = "Загрузка…" }: { text?: string }) {
  return (
    <div className="muted" style={{ padding: 40, textAlign: "center" }}>
      {text}
    </div>
  );
}