// NNC team chat buddy: a small friendly character with a headset (original SVG, animated with CSS)
export default function Mascot({ size = 64, happy = false }) {
  return (
    <svg className={`masc ${happy ? "happy" : ""}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="mHead" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E6ECFF" /></radialGradient>
        <linearGradient id="mBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B6FF0" /><stop offset="1" stopColor="#4F46E5" /></linearGradient>
      </defs>
      {/* shadow */}
      <ellipse className="m-shadow" cx="60" cy="112" rx="26" ry="5" fill="#0F172A" opacity=".12" />
      <g className="m-float">
        {/* body */}
        <path d="M30 96c0-16 13-26 30-26s30 10 30 26v6H30z" fill="url(#mBody)" />
        <circle cx="60" cy="88" r="5" fill="#fff" opacity=".9" />
        {/* waving arm */}
        <g className="m-arm"><path d="M88 84c8-4 12-12 12-20" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" fill="none" /><circle cx="100" cy="62" r="6" fill="#FFD9C2" /></g>
        <path d="M32 86c-6 2-9 8-9 13" stroke="#3B6FF0" strokeWidth="8" strokeLinecap="round" fill="none" />
        {/* head */}
        <circle cx="60" cy="46" r="30" fill="url(#mHead)" stroke="#D5DEFA" strokeWidth="1.5" />
        {/* hair tuft */}
        <path d="M48 19c6-6 18-6 22 2-6-2-12-1-16 3z" fill="#1E293B" />
        {/* headset */}
        <path d="M31 46a29 29 0 0 1 58 0" stroke="#0F172A" strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x="25" y="40" width="9" height="16" rx="4" fill="#0F172A" />
        <rect x="86" y="40" width="9" height="16" rx="4" fill="#0F172A" />
        <path d="M30 56c2 10 10 15 20 15" stroke="#0F172A" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="52" cy="71" r="3.5" fill="#2563EB" />
        {/* face */}
        <g className="m-eyes"><ellipse cx="49" cy="46" rx="4" ry="5" fill="#0F172A" /><ellipse cx="71" cy="46" rx="4" ry="5" fill="#0F172A" />
          <circle cx="50.5" cy="44" r="1.4" fill="#fff" /><circle cx="72.5" cy="44" r="1.4" fill="#fff" /></g>
        <ellipse cx="42" cy="55" rx="4.5" ry="2.6" fill="#FDA4AF" opacity=".55" />
        <ellipse cx="78" cy="55" rx="4.5" ry="2.6" fill="#FDA4AF" opacity=".55" />
        <path className="m-mouth" d="M53 56c3 4 11 4 14 0" stroke="#0F172A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
