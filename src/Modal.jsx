import { useEffect } from "react";

export default function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true">
        <div className="mh"><b>{title}</b><button type="button" onClick={onClose} aria-label="Close">×</button></div>
        <div className="mb">{children}</div>
      </div>
    </div>
  );
}
