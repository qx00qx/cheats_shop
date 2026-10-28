import { useEffect, useState } from "react";
import { getOnlineCount } from "../utils/onlineCount";

export default function OnlineCounter() {
  const [online, setOnline] = useState(() => getOnlineCount());

  useEffect(() => {
    const intervalId = window.setInterval(() => setOnline(getOnlineCount()), 8000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="nx-online" aria-live="polite" title="Пользователей на сайте">
      <span className="nx-online__dot" aria-hidden="true" />
      <strong className="nx-online__value">{online.toLocaleString("ru-RU")}</strong>
      <span className="nx-online__label">онлайн</span>
    </div>
  );
}
