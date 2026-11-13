import { isMobileDevice } from "../../device";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePortal } from "../../auth/store";
import { ROLES, DOMAIN } from "../../roles";
import { api } from "../../api";
import { toast } from "../../toast";
import PwInput from "../../PwInput";

function Side() {
  return (
    <div className="side">
      <div className="brand"><span className="mk logo"><img src="/nnclogo.png" alt="NNC" /></span><span>Nakshatra Namaha Creations<small>Employee Portal</small></span></div>
      <h1>Your work, your clients,<br /><span>one login.</span></h1>
      <p>Sign in to log your daily work, update bugs and designs, send client reports and meeting minutes. Everything you update reaches the management dashboard straight away.</p>
      <div className="feat">
        <div><i>1</i><span><b>Daily work with links and hours</b>Backlinks, blogs, GMB posts, features, builds, designs, test runs.</span></div>
        <div><i>2</i><span><b>Client reports</b>Daily Google Ads updates and keyword positions, straight into the CRM.</span></div>
        <div><i>3</i><span><b>Bugs</b>Raise, fix and verify, between testers and developers.</span></div>
        <div><i>4</i><span><b>Meeting minutes</b>Notes and photos in, MOM out, ready for WhatsApp and email.</span></div>
      </div>
    </div>
  );
}

function usePublicSettings() {
  const [s, setS] = useState({ approval: true, domainOnly: false, domain: DOMAIN });
  useEffect(() => { api("/settings").then(j => setS(j.data)).catch(() => {}); }, []);
  return s;
}

export function Login() {
  const { signIn } = usePortal();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [fp, setFp] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), id = String(f.get("uid")).trim(), pw = String(f.get("pw")), rem = !!f.get("rem");
    setErr(""); setBusy(true);
    try {
      const j = await api("/login", { method: "POST", body: { id, password: pw, mobile: isMobileDevice() }, token: "" });
      signIn({ type: "emp", token: j.data.token, user: j.data.user }, rem);
      toast(`Welcome, ${j.data.user.name}`);
      nav("/");
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth"><Side />
      <div className="main"><div className="box">
        <h2>Welcome back<span>.</span></h2>
        <p className="lead">Sign in with your work email or mobile number.</p>
        {err && <div className="err">{err}</div>}
        {fp && <div className="okm">Ask your admin to reset your password in the CRM. They will give you a temporary password, and you will set a new one when you sign in.</div>}
        <form onSubmit={submit}>
          <div className="f"><label htmlFor="li1">Work email or mobile number</label>
            <input id="li1" name="uid" type="text" autoComplete="username" required placeholder={`name@${DOMAIN}`} /></div>
          <div className="f"><label htmlFor="li2">Password</label><PwInput id="li2" name="pw" autoComplete="current-password" required /></div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" name="rem" defaultChecked /> Keep me signed in</label>
            <button type="button" className="link" onClick={() => setFp(true)}>Forgot password?</button>
          </div>
          <button className="btn p full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p style={{ textAlign: "center", marginTop: 18 }}>New to NNC? <Link className="link" to="/signup">Create your account</Link></p>
      </div></div>
    </div>
  );
}

function strength(v) {
  let s = 0;
  if (v.length >= 8) s++;
  if (/\d/.test(v)) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return s;
}
function PwField({ value, onChange }) {
  const st = strength(value);
  return (
    <div className="f"><label htmlFor="p1">Password</label>
      <PwInput id="p1" name="pw" required minLength={8} autoComplete="new-password" value={value} onChange={e => onChange(e.target.value)} />
      <div className="pwbar"><i style={{ width: `${st * 25}%`, background: ["#DC2626", "#DC2626", "#F59E0B", "#059669", "#059669"][st] }} /></div>
      <span className="sub">{value ? ["Too short", "Weak", "Fair", "Good", "Strong"][st] : "At least 8 characters, with a number"}</span></div>
  );
}

export function Signup() {
  const { signIn } = usePortal();
  const S = usePublicSettings();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [d, setD] = useState({ name: "", email: "", phone: "", role: "" });
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const set = (k) => (e) => setD(s => ({ ...s, [k]: e.target.value }));
  const R = ROLES[d.role];

  const s1 = (e) => {
    e.preventDefault();
    const email = d.email.trim().toLowerCase();
    if (S.domainOnly && !email.endsWith(`@${S.domain}`)) { setErr(`Please use your @${S.domain} email.`); return; }
    if (d.phone.replace(/\D/g, "").length < 10) { setErr("Enter a 10 digit mobile number."); return; }
    setErr(""); setD(s => ({ ...s, email, name: s.name.trim() })); setStep(2);
  };
  const s3 = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get("pw") !== f.get("pw2")) { setErr("The two passwords do not match."); return; }
    if (!/\d/.test(f.get("pw"))) { setErr("Add at least one number to your password."); return; }
    setErr(""); setBusy(true);
    try {
      const j = await api("/signup", { method: "POST", body: { ...d, password: f.get("pw"), mobile: isMobileDevice() }, token: "" });
      if (j.pending) { setPending(true); return; }
      signIn({ type: "emp", token: j.data.token, user: j.data.user });
      toast(`Account created. Welcome to NNC, ${j.data.user.name}!`);
      nav("/");
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };
  const steps = <div className="steps"><span className="on" /><span className={step >= 2 ? "on" : ""} /><span className={step >= 3 ? "on" : ""} /></div>;

  return (
    <div className="auth"><Side />
      <div className="main"><div className="box">
        {pending ? (
          <>
            <h2>Account created<span>.</span></h2>
            <div className="okm">The admin needs to approve your account before you can sign in. You can sign in with {d.email} once it is approved.</div>
            <Link className="btn p" to="/login">Back to sign in</Link>
          </>
        ) : step === 1 ? (
          <>
            <h2>Create your account<span>.</span></h2><p className="lead">Step 1 of 3 · About you</p>{steps}
            {err && <div className="err">{err}</div>}
            <form onSubmit={s1}>
              <div className="f"><label htmlFor="s1">Full name</label><input id="s1" type="text" required value={d.name} onChange={set("name")} autoComplete="name" /></div>
              <div className="f"><label htmlFor="s2">Work email</label><input id="s2" type="email" required value={d.email} onChange={set("email")} placeholder={`name@${S.domain}`} autoComplete="email" /></div>
              <div className="f"><label htmlFor="s3">Mobile number</label><input id="s3" type="tel" required value={d.phone} onChange={set("phone")} placeholder="98450 00000" autoComplete="tel" /></div>
              <div className="f"><label htmlFor="s4">Your role</label>
                <select id="s4" required value={d.role} onChange={set("role")}>
                  <option value="">Choose your role</option>
                  {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.l} · {r.dept}</option>)}
                </select></div>
              <button className="btn p full">Continue</button>
            </form>
          </>
        ) : step === 2 ? (
          <>
            <h2>What you work on<span>.</span></h2>
            <p className="lead">Step 2 of 3 · {R.l}</p>{steps}
            <div className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
              {R.pick === "clients" ? "Your manager assigns your clients in the CRM (SEO & Ads Team). They appear in your portal as soon as you are assigned."
                : R.pick === "projects" ? "Your manager adds you to projects in the CRM (project Developers). They appear in your portal as soon as you are added."
                  : "Accountants see every project for invoices and payments."}
            </div>
            <div className="row"><button type="button" className="btn" onClick={() => setStep(1)}>Back</button><button type="button" className="btn p" style={{ flex: 1 }} onClick={() => setStep(3)}>Continue</button></div>
          </>
        ) : (
          <>
            <h2>Set your password<span>.</span></h2><p className="lead">Step 3 of 3 · {d.name}, {R.l}</p>{steps}
            {err && <div className="err">{err}</div>}
            <form onSubmit={s3}>
              <PwField value={pw} onChange={setPw} />
              <div className="f"><label htmlFor="p2">Confirm password</label><PwInput id="p2" name="pw2" required autoComplete="new-password" /></div>
              <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 16, alignItems: "flex-start", flexWrap: "nowrap" }}>
                <input type="checkbox" required style={{ marginTop: 3 }} /> I will keep my login private and log my own work only.</label>
              <div className="row"><button type="button" className="btn" onClick={() => setStep(2)}>Back</button><button className="btn p" style={{ flex: 1 }} disabled={busy}>{busy ? "Creating…" : "Create account"}</button></div>
            </form>
          </>
        )}
        {!pending && <p style={{ textAlign: "center", marginTop: 18 }}>Already have an account? <Link className="link" to="/login">Sign in</Link></p>}
      </div></div>
    </div>
  );
}

// Shown after an admin reset: choose a new password before continuing
export function ForceChange() {
  const { refresh, signOut } = usePortal();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get("pw") !== f.get("pw2")) { setErr("The two passwords do not match."); return; }
    try { await api("/me/password", { method: "PUT", body: { password: f.get("pw") } }); toast("Password saved"); refresh(); }
    catch (ex) { setErr(ex.message); }
  };
  return (
    <div className="auth"><Side />
      <div className="main"><div className="box">
        <h2>Set a new password<span>.</span></h2>
        <p className="lead">Your password was reset by the admin. Choose a new one to continue.</p>
        {err && <div className="err">{err}</div>}
        <form onSubmit={submit}>
          <PwField value={pw} onChange={setPw} />
          <div className="f"><label htmlFor="fp2">Confirm</label><PwInput id="fp2" name="pw2" required /></div>
          <button className="btn p full">Save and continue</button>
        </form>
        <p style={{ textAlign: "center", marginTop: 18 }}><button type="button" className="link" onClick={signOut}>Sign out</button></p>
      </div></div>
    </div>
  );
}
