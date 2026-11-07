import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileText, Film, X } from "lucide-react";
import { upload, fileUrl } from "./api";
import { toast } from "./toast";

const isImg = (f) => /^image\//.test(f.type || "") || /\.(png|jpe?g|gif|webp)$/i.test(f.url || "");
// Attach files: click to browse, drag them in, or paste (Ctrl+V) a copied screenshot or file.
// Each one uploads straight away. A paste goes to the attach box nearest to where you are typing.
const MAX_FILES = 10, MAX_MB = 25, MAX_VIDEO_MB = 100;
const isVid = (f) => /^video\//.test(f.type || "") || /\.(mp4|mov|webm|mkv|avi)$/i.test(f.url || f.name || "");
const kb = (n) => (!n ? "" : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
const extOf = (f) => (String(f.name || f.url).split(".").pop() || "").slice(0, 4).toUpperCase();
// the largest part of the page that holds this attach box and no other
function scopeOf(el) {
  let s = el;
  while (s?.parentElement && s.tagName !== "FORM" && s.parentElement !== document.body && s.parentElement.querySelectorAll(".fp").length === 1) s = s.parentElement;
  return s;
}
// a pasted screenshot is called "image.png"; give it a readable name
const named = (f) => {
  if (!/^image\.(png|jpe?g|gif|webp)$/i.test(f.name || "")) return f;
  const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
  return new File([f], `Screenshot ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}.${p2(d.getMinutes())}.${p2(d.getSeconds())}.${f.name.split(".").pop()}`, { type: f.type });
};

export function FilePick({ files, onChange, id, hint }) {
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const zone = useRef(null);
  const count = useRef(files.length);
  useEffect(() => { count.current = files.length; }, [files.length]);

  const add = useCallback(async (list) => {
    let L = [...list].map(named);
    const room = MAX_FILES - count.current;
    if (room <= 0) { toast(`Up to ${MAX_FILES} files can be attached`); return; }
    if (L.length > room) { toast(`Only ${room} more file${room > 1 ? "s" : ""} can be attached`); L = L.slice(0, room); }
    setBusy(n => n + L.length);
    for (const f of L) {
      const lim = isVid(f) ? MAX_VIDEO_MB : MAX_MB;
      if (f.size > lim * 1048576) toast(`${f.name} is over ${lim} MB`);
      else {
        try { const d = await upload(f); onChange(prev => [...prev, { ...d, size: d.size || f.size }]); }
        catch (ex) { toast(ex.message); }
      }
      setBusy(n => n - 1);
    }
  }, [onChange]);

  // Ctrl+V with a copied image or file, anywhere in this form (text pastes work as usual)
  useEffect(() => {
    const onPaste = (e) => {
      const el = zone.current;
      if (!el) return;
      const t = e.target instanceof Element ? e.target : document.body;
      const mine = scopeOf(el).contains(t) || el.contains(document.activeElement) || (t === document.body && document.querySelectorAll(".fp").length === 1);
      if (!mine) return;
      const F = [...(e.clipboardData?.files || [])];
      if (!F.length) return;
      e.preventDefault();
      add(F);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [add]);

  const drop = (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files?.length) add(e.dataTransfer.files); };
  return (
    <div className="fp">
      <label ref={zone} htmlFor={id} className={`fp-zone${over ? " over" : ""}`} tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById(id)?.click(); } }}>
        <span className="fp-ic"><UploadCloud size={22} /></span>
        <span className="fp-t"><b>Drop files here, paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>, or <u>browse</u></b>
          <small>{hint || `Screenshots, screen recordings, PDF, Word, Excel or zip · up to ${MAX_FILES} files (${MAX_MB} MB each, videos ${MAX_VIDEO_MB} MB)`}</small></span>
      </label>
      <input id={id} type="file" multiple hidden accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {(files.length > 0 || busy > 0) && (
        <div className="fp-list">
          {files.map((f, i) => (
            <div key={f.url} className="fp-item">
              {isImg(f) ? <img src={fileUrl(f.url)} alt="" /> : isVid(f) ? <span className="fp-doc vid"><Film size={18} /><em>VIDEO</em></span> : <span className="fp-doc"><FileText size={18} /><em>{extOf(f)}</em></span>}
              <span className="fp-name"><a href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" title={f.name}>{f.name}</a><small>{kb(f.size)}</small></span>
              <button type="button" className="fp-x" aria-label={`Remove ${f.name}`} onClick={() => onChange(prev => prev.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <div key={`u${i}`} className="fp-item up"><span className="fp-doc"><span className="fp-spin" /></span><span className="fp-name"><b>Uploading…</b></span></div>
          ))}
        </div>
      )}
    </div>
  );
}

