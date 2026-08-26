import { useEffect, useRef, useState } from "react";
import type { Translate } from "../lib/i18n";
import { hasAccounts } from "../lib/auth";
import type { LoginResult } from "../lib/auth";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (id: string, password: string) => Promise<LoginResult>;
  t: Translate;
}

export function LoginDialog({ open, onClose, onSubmit, t }: Props) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setId("");
    setPassword("");
    setError(null);
    setBusy(false);
    const focus = setTimeout(() => first.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    // PBKDF2 20만 회는 기기에 따라 1초 가까이 걸린다 — 그동안 버튼을 잠근다.
    const result = await onSubmit(id, password);
    if (result.ok) {
      onClose();
      return;
    }
    setError(t(result.reason === "unsupported" ? "login.unsupported" : "login.failed"));
    setPassword("");
    setBusy(false);
  }

  return (
    <div className="modal no-print" role="presentation" onMouseDown={onClose}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="modal__title" id="login-title">
          <span aria-hidden="true">🔐</span> {t("login.title")}
        </h2>
        <p className="modal__desc">{t("login.desc")}</p>

        {!hasAccounts ? (
          <>
            <p className="modal__warn">{t("login.noAccounts")}</p>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose}>
                {t("login.cancel")}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="field">
              <span className="field__label">{t("login.id")}</span>
              <input
                ref={first}
                className="field__input"
                value={id}
                onChange={(e) => setId(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">{t("login.password")}</span>
              <input
                className="field__input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <p className="modal__error" role="alert">
                {error}
              </p>
            )}

            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                {t("login.cancel")}
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? t("login.checking") : t("login.submit")}
              </button>
            </div>
          </form>
        )}

        <p className="modal__note">{t("login.note")}</p>
      </div>
    </div>
  );
}
