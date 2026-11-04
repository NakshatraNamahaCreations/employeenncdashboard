import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PortalProvider } from "./auth/store";
import App from "./App";
import { ConfirmHost } from "./confirm";
import "./styles.css";
import "./styles-v2.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <PortalProvider>
        <App />
        <ConfirmHost />
      </PortalProvider>
    </BrowserRouter>
  </StrictMode>
);
