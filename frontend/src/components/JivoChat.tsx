import { useEffect } from "react";
import { useAuth } from "../store/auth";

const JIVO_WIDGET_ID = import.meta.env.VITE_JIVO_WIDGET_ID;

export default function JivoChat() {
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (!JIVO_WIDGET_ID) {
      console.warn("VITE_JIVO_WIDGET_ID is not set");
      return;
    }

    if (document.getElementById("jivo-script")) return;

    const script = document.createElement("script");
    script.id = "jivo-script";
    script.src = `https://code.jivosite.com/widget/${JIVO_WIDGET_ID}`;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!user) return;

    const timer = window.setInterval(() => {
      if (window.jivo_api?.setContactInfo) {
        window.jivo_api.setContactInfo({
          name: user.username,
          email: user.email,
        });
        window.clearInterval(timer);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [user]);

  return null;
}