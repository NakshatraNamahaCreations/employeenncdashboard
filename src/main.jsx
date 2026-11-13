import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PortalProvider } from "./auth/store";
import App from "./App";
import { ConfirmHost } from "./confirm";
import "./styles.css";
import "./styles-v2.css";

// The mouse wheel over a number box scrolls the page; it never changes the number
document.addEventListener("wheel", (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.type === "number" && document.activeElement === t) t.blur();
}, { passive: true });

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
