import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useSettings } from "./context/SettingsContext";

type NavItem = {
  to: string;
  label: string;
  roles?: Array<"GOD" | "ADMIN" | "ANALYST" | "VIEWER">;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Resumen",
    items: [
      { to: "/", label: "Panel" },
      { to: "/stats", label: "Estadísticas", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
    ],
  },
  {
    title: "Operación",
    items: [
      { to: "/upload", label: "Subir CSV", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/transactions/movements", label: "Movimientos", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/counterparts", label: "Contrapartes", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/transactions/participants", label: "Participantes", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/transactions/balances", label: "Saldos diarios", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/supplies", label: "Solicitud de Insumos", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
    ],
  },
  {
    title: "Personas",
    items: [
      { to: "/employees", label: "Trabajadores", roles: ["GOD", "ADMIN"] },
      { to: "/timesheets", label: "Horas y pagos", roles: ["GOD", "ADMIN", "ANALYST"] },
    ],
  },
  {
    title: "Administración",
    items: [{ to: "/settings", label: "Configuración", roles: ["GOD", "ADMIN"] }],
  },
];

const TITLES: Record<string, string> = {
  "/": "Panel financiero",
  "/upload": "Subir movimientos a la base",
  "/transactions/movements": "Movimientos registrados",
  "/counterparts": "Contrapartes",
  "/transactions/participants": "Participantes",
  "/timesheets": "Horas y pagos",
  "/transactions/balances": "Saldos diarios",
  "/employees": "Trabajadores",
  "/supplies": "Solicitud de Insumos",
  "/data": "Movimientos registrados",
  "/stats": "Estadísticas",
  "/settings": "Configuración",
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = TITLES[location.pathname] ?? "Bioalergia Finanzas";
  const { user, logout, hasRole } = useAuth();
  const { settings } = useSettings();

  const navigation = NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter((item) => !item.roles || hasRole(...item.roles)),
  })).filter((section) => section.items.length);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#f6fbff] text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--brand-secondary)]/40 bg-white shadow-xl">
        <div className="flex flex-col gap-6 px-6 py-8">
          <div className="flex flex-col items-start gap-3">
            <div className="w-full rounded-lg bg-white/60 p-3 shadow-sm">
              <img
                src={settings.logoUrl}
                alt={settings.orgName}
                className="mx-auto max-h-16 object-contain"
              />
            </div>
            <p className="text-sm text-slate-500">{settings.tagline}</p>
          </div>
          <nav className="space-y-4">
            {navigation.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.title}
                </p>
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-[var(--brand-primary)] text-white shadow-md"
                            : "text-slate-600 hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)]"
                        }`
                      }
                    >
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-auto px-6 pb-6 text-xs text-slate-400">
          © {new Date().getFullYear()} {settings.orgName}. Todos los derechos reservados.
        </div>
      </aside>
      <main className="flex min-h-screen flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--brand-primary)]/15 bg-white px-8 py-6 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-[var(--brand-primary)]">{title}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="text-right">
              <p className="font-medium text-slate-700">{user?.email}</p>
              <p className="text-xs uppercase tracking-wide text-slate-400">Rol: {user?.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Cerrar sesión
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
