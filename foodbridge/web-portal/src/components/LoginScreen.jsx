import { useState } from "react";
import { api } from "../api.js";

export default function LoginScreen({ onLogin, serviceError }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", org: "" });
  const isRegister = mode === "register";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const profile = await api(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        body: isRegister ? { ...form, role: "volunteer" } : { email: form.email, password: form.password },
      });
      onLogin(profile);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand brand-light" href="#home"><span className="brand-mark">f<span>+</span></span><span>foodbridge<small>GOOD FOOD GOES FURTHER</small></span></a>
        <div className="auth-story-copy"><p className="eyebrow">A LITTLE KINDNESS, DELIVERED</p><h1>Be the reason<br />someone eats <em>well.</em></h1><p>Join neighbors turning extra food into something extraordinary.</p></div>
        <div className="auth-story-bottom"><span>✳</span><span>Less waste. More care.<br /><b>More good in the world.</b></span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{isRegister ? "YOUR COMMUNITY NEEDS YOU" : "WELCOME BACK, GOOD HUMAN"}</p>
          <h2>{isRegister ? "Let’s get you started." : "Ready for another good run?"}</h2>
          <p className="auth-subtitle">{isRegister ? "Create your volunteer account to start rescuing meals." : "Sign in to see what you can rescue today."}</p>
          {serviceError && <p className="form-error" role="status">FoodBridge could not verify your session: {serviceError}</p>}
          <form onSubmit={submit} className="auth-form">
            {isRegister && <label>Your name<input autoComplete="name" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="How should we call you?" /></label>}
            <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
            {isRegister && <label>Community or organization <span className="optional">(optional)</span><input autoComplete="organization" maxLength={80} value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} placeholder="Where do you volunteer?" /></label>}
            <label>Password<input type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 10 : undefined} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isRegister ? "At least 10 characters" : "Your password"} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" disabled={busy}>{busy ? "One moment…" : isRegister ? "Create volunteer account" : "Sign in"}<span>→</span></button>
          </form>
          <p className="auth-switch">{isRegister ? "Already part of the good?" : "New to FoodBridge?"} <button onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}>{isRegister ? "Sign in" : "Join as a volunteer"}</button></p>
          <p className="auth-security"><span>♧</span> Your account is protected with secure sign-in.</p>
        </div>
      </section>
    </main>
  );
}
