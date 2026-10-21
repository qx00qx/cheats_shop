import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        plugins: [react()],
        esbuild: command === "build" ? { drop: ["console", "debugger"] } : undefined,
        server: {
            port: 5173,
            proxy: {
                "/api": { target: "http://backend:8000", changeOrigin: true },
                "/uploads": { target: "http://backend:8000", changeOrigin: true },
            },
        },
    });
});
