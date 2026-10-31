"use client";
import { useEffect, useId, useRef, useState } from "react";
import { login } from "@/app/auth-actions";
import { Icon } from "@/components/icon";
import { SubmitButton } from "@/components/submit-button";

/** Messages for the redirects produced by the existing `login` server action (?error=…). */
const serverErrors: Record<string, string> = {
  unavailable: "Sign-in is temporarily unavailable. Check that PostgreSQL is running and try again.",
  limited: "Too many attempts. Try again after 15 minutes.",
  invalid: "Invalid email or password.",
};

const REMEMBER_KEY = "sentinelx.remembered-email";
const LAST_KEY = "sentinelx.last-email";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = { email?: string; password?: string };

const validate = (email: string, password: string): Errors => {
  const errors: Errors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = "Enter your email address.";
  else if (trimmed.length > 254 || !emailPattern.test(trimmed)) errors.email = "Enter a valid email address, like you@organization.com.";
  if (!password) errors.password = "Enter your password.";
  else if (new TextEncoder().encode(password).length > 72) errors.password = "Passwords can be at most 72 bytes long.";
  return errors;
};

const storage = {
  get: (area: "local" | "session", key: string) => {
    try { return (area === "local" ? window.localStorage : window.sessionStorage).getItem(key); } catch { return null; }
  },
  set: (area: "local" | "session", key: string, value: string) => {
    try { (area === "local" ? window.localStorage : window.sessionStorage).setItem(key, value); } catch { /* storage unavailable */ }
  },
  remove: (area: "local" | "session", key: string) => {
    try { (area === "local" ? window.localStorage : window.sessionStorage).removeItem(key); } catch { /* storage unavailable */ }
  },
};

export function LoginForm({ error }: { error?: string }) {
  const ids = useId();
  const emailId = `${ids}-email`;
  const passwordId = `${ids}-password`;
  const forgotId = `${ids}-forgot`;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [shown, setShown] = useState(false);
  const [remember, setRemember] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const banner = error ? (serverErrors[error] ?? serverErrors.invalid) : null;

  // Restore the remembered email (device-local), or the email just attempted when the server rejected it.
  useEffect(() => {
    const remembered = storage.get("local", REMEMBER_KEY);
    const last = storage.get("session", LAST_KEY);
    storage.remove("session", LAST_KEY);
    const value = (error ? last : null) ?? remembered ?? "";
    if (emailRef.current && value) emailRef.current.value = value;
    if (remembered) setRemember(true);
    setReady(true);
    if (error) bannerRef.current?.focus();
  }, [error]);

  const check = (field: "email" | "password") => {
    const next = validate(emailRef.current?.value ?? "", passwordRef.current?.value ?? "");
    setErrors((current) => ({ ...current, [field]: next[field] }));
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const email = emailRef.current?.value ?? "";
    const next = validate(email, passwordRef.current?.value ?? "");
    if (next.email || next.password) {
      event.preventDefault();
      setErrors(next);
      (next.email ? emailRef.current : passwordRef.current)?.focus();
      return;
    }
    // The email address (never the password) can be remembered on this device.
    if (remember) storage.set("local", REMEMBER_KEY, email.trim());
    else storage.remove("local", REMEMBER_KEY);
    storage.set("session", LAST_KEY, email.trim());
  };

  return (
    <form action={login} onSubmit={onSubmit} noValidate={ready} className="lx-form" aria-describedby={banner ? `${ids}-banner` : undefined}>
      {banner && (
        <div className="lx-banner" id={`${ids}-banner`} role="alert" tabIndex={-1} ref={bannerRef}>
          <Icon name="alert" size={18} />
          <p>{banner}</p>
        </div>
      )}

      <div className="lx-field">
        <label htmlFor={emailId}>Email address</label>
        <input
          ref={emailRef}
          id={emailId}
          className="lx-input"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          placeholder="you@organization.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
          onBlur={() => emailRef.current?.value && check("email")}
          onChange={() => errors.email && check("email")}
        />
        {errors.email && <p className="lx-error" id={`${emailId}-error`}><Icon name="alert" size={14} />{errors.email}</p>}
      </div>

      <div className="lx-field">
        <label htmlFor={passwordId}>Password</label>
        <div className="lx-password">
          <input
            ref={passwordRef}
            id={passwordId}
            className="lx-input"
            name="password"
            type={shown ? "text" : "password"}
            required
            autoComplete="current-password"
            maxLength={72}
            placeholder="Enter your password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
            onChange={() => errors.password && check("password")}
          />
          <button type="button" className="lx-reveal" onClick={() => setShown((value) => !value)} aria-pressed={shown} aria-label="Show password" aria-controls={passwordId}>
            <Icon name={shown ? "eyeOff" : "eye"} size={19} />
          </button>
        </div>
        {errors.password && <p className="lx-error" id={`${passwordId}-error`}><Icon name="alert" size={14} />{errors.password}</p>}
      </div>

      <div className="lx-row">
        <label className="lx-check">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} aria-describedby={`${ids}-remember-hint`} />
          <span className="lx-check__box" aria-hidden="true"><Icon name="check" size={14} /></span>
          <span>Remember me</span>
        </label>
        <span className="sr-only" id={`${ids}-remember-hint`}>Saves your email address in this browser. Your password is never stored.</span>
        <button type="button" className="lx-link" aria-expanded={forgotOpen} aria-controls={forgotId} onClick={() => setForgotOpen((value) => !value)}>
          Forgot password?
        </button>
      </div>

      <p className="lx-note" id={forgotId} hidden={!forgotOpen}>
        Password reset isn’t available in this workspace yet. Ask your SentinelX administrator to help you regain access.
      </p>

      <SubmitButton pendingText="Signing in…" className="lx-submit">
        <span>Sign in</span>
        <span className="lx-submit__arrow"><Icon name="arrow" size={18} /></span>
      </SubmitButton>
    </form>
  );
}
