import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings, type AppSettings } from "../context/SettingsContext";

const fields: Array<{ key: keyof AppSettings; label: string; type?: string; helper?: string }> = [
  { key: "orgName", label: "Nombre de la organización" },
  { key: "tagline", label: "Eslogan", helper: "Texto corto que se muestra en el panel" },
  { key: "primaryColor", label: "Color primario", type: "color" },
  { key: "secondaryColor", label: "Color secundario", type: "color" },
  { key: "logoUrl", label: "URL del logo" },
  { key: "supportEmail", label: "Correo de soporte" },
  { key: "orgPhone", label: "Teléfono de contacto" },
  { key: "orgAddress", label: "Dirección" },
  { key: "primaryCurrency", label: "Moneda principal", helper: "Ejemplo: CLP, USD" },
];

function normalizeExternalUrl(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^http:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, "https://");
  return `https://${trimmed}`;
}

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<AppSettings>(settings);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasRole("GOD", "ADMIN");
  const databaseUrl = normalizeExternalUrl(settings.dbConsoleUrl);
  const cpanelUrl = normalizeExternalUrl(settings.cpanelUrl);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleChange = (key: keyof AppSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    setStatus("saving");
    setError(null);
    try {
      await updateSettings(form);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setStatus("error");
    }
  };

  if (!canEdit) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Configuración</h1>
        <p className="rounded-2xl border border-amber-200 bg-white p-6 text-sm text-amber-700 shadow-sm">
          Necesitas permisos de administrador para editar la configuración.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Configuración general</h1>
        <p className="text-sm text-slate-600">
          Personaliza la identidad visual y la información de contacto. Tus cambios aplican a todos
          los usuarios de la plataforma.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--brand-secondary)]/15 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Accesos rápidos</h2>
          <p className="text-sm text-slate-600">
            Usa estos accesos para abrir los paneles de administración configurados sin exponer las URLs.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => cpanelUrl && window.open(cpanelUrl, "_blank", "noopener,noreferrer")}
            disabled={!cpanelUrl}
            className="rounded-full border border-[var(--brand-secondary)] px-4 py-2 text-sm font-semibold text-[var(--brand-secondary)] shadow disabled:cursor-not-allowed"
          >
            Ir a cPanel
          </button>
          <button
            type="button"
            onClick={() => databaseUrl && window.open(databaseUrl, "_blank", "noopener,noreferrer")}
            disabled={!databaseUrl}
            className="rounded-full border border-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] shadow disabled:cursor-not-allowed"
          >
            Ir a la base de datos
          </button>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(({ key, label, type, helper }) => (
            <label key={key} className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </span>
              {type === "color" ? (
                <input
                  type="color"
                  value={form[key]}
                  onChange={(event) => handleChange(key, event.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border"
                />
              ) : (
                <input
                  type="text"
                  value={form[key]}
                  onChange={(event) => handleChange(key, event.target.value)}
                  className="rounded border px-3 py-2"
                  placeholder={label}
                />
              )}
              {helper && <span className="text-xs text-slate-400">{helper}</span>}
            </label>
          ))}
        </div>
        {error && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {status === "success" && !error && (
          <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm text-emerald-700">
            La configuración se ha guardado correctamente.
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {status === "saving" ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

    </section>
  );
}
