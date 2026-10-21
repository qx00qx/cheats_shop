import axios from "axios";

const configuredBaseURL = import.meta.env.VITE_API_URL || "/api";
const baseURL = (() => {
  if (typeof window === "undefined") return configuredBaseURL;

  const url = new URL(configuredBaseURL, window.location.origin);
  if (window.location.protocol === "https:" && url.protocol === "http:" && url.hostname === window.location.hostname) {
    url.protocol = "https:";
  }

  return url.toString().replace(/\/$/, "");
})();

console.log("API Base URL:", baseURL);

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("millex_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;

  console.log("API Request:", cfg.method?.toUpperCase(), cfg.baseURL + (cfg.url || ""));
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    console.error("API Error:", err.response?.status, err.config?.url);
    return Promise.reject(err);
  }
);