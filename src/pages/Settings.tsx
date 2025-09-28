import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import InventoryCategoryManager from "../features/inventory/components/InventoryCategoryManager";
import RoleMappingManager from "../features/roles/components/RoleMappingManager";
import SettingsForm from "../components/SettingsForm";
import Button from "../components/Button";

function normalizeExternalUrl(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const { settings } = useSettings();

  const canEdit = hasRole("GOD", "ADMIN");
  const databaseUrl = normalizeExternalUrl(settings.dbConsoleUrl);
  const cpanelUrl = normalizeExternalUrl(settings.cpanelUrl);

  if (!canEdit) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Configuración</h1>
        <p className="glass-card border-l-4 border-amber-300/80 bg-gradient-to-r from-amber-50/75 via-white/70 to-white/55 p-6 text-sm text-amber-700">
          Necesitas permisos de administrador para editar la configuración.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="glass-card glass-underlay-gradient space-y-2 p-6">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">Configuración general</h1>
        <p className="text-sm text-slate-600/90">
          Personaliza la identidad visual y la información de contacto. Tus cambios aplican a todos
          los usuarios de la plataforma.
        </p>
      </div>

      <section className="glass-card glass-underlay-gradient space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--brand-primary)] drop-shadow-sm">Accesos rápidos</h2>
          <p className="text-sm text-slate-600/90">
            Usa estos accesos para abrir los paneles de administración configurados.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => cpanelUrl && window.open(cpanelUrl, "_blank", "noopener,noreferrer")}
            disabled={!cpanelUrl}
          >
            Ir a cPanel
          </Button>
          <Button
            variant="secondary"
            onClick={() => databaseUrl && window.open(databaseUrl, "_blank", "noopener,noreferrer")}
            disabled={!databaseUrl}
          >
            Ir a la base de datos
          </Button>
        </div>
      </section>

      <InventoryCategoryManager />

      <RoleMappingManager />

      <SettingsForm />

    </section>
  );
}
