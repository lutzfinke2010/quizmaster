import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";
import { configureCloud } from "./cloud";

const root = createRoot(document.getElementById("root")!);
configureCloud().then((cloudConfigured) => {
  root.render(<StrictMode><BrowserRouter><App cloudConfigured={cloudConfigured} /></BrowserRouter></StrictMode>);
}).catch((error: unknown) => {
  root.render(<div className="container"><p className="error-banner" role="alert">
    Die Anwendungskonfiguration konnte nicht geladen werden: {error instanceof Error ? error.message : "Unbekannter Fehler"}
  </p></div>);
});
