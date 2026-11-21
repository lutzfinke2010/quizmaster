import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./ui/base.css";
import { configureCloud } from "./cloud";

const root = createRoot(document.getElementById("root")!);
configureCloud().then((cloudConfigured) => {
  root.render(<StrictMode><BrowserRouter><App cloudConfigured={cloudConfigured} /></BrowserRouter></StrictMode>);
}).catch((error: unknown) => {
  root.render(<main className="rl-boot-error">
    <p className="rl-notice rl-notice-error" role="alert">
      Die Anwendungskonfiguration konnte nicht geladen werden: {error instanceof Error ? error.message : "Unbekannter Fehler"}
    </p>
  </main>);
});
