import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      logger.info("[login-page] envío credenciales", { email });
      await login(email, password);
      logger.info("[login-page] login OK", { email });
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      setError(message);
      logger.error("[login-page] login error", { email, message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6fbff] p-6">
      <div className="w-full max-w-md rounded-3xl border border-[var(--brand-primary)]/15 bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src={settings.logoUrl}
            alt={settings.orgName}
            className="max-h-20 object-contain"
          />
          <h1 className="text-xl font-semibold text-[var(--brand-primary)]">
            Inicia sesión en {settings.orgName}
          </h1>
          <p className="text-sm text-slate-500">Usa tu correo corporativo para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-sm">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border px-3 py-2"
              placeholder="usuario@bioalergia.cl"
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contraseña
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded border px-3 py-2"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          ¿Olvidaste tu contraseña? Contacta a <strong>{settings.supportEmail}</strong>
        </p>
      </div>
    </div>
  );
}
