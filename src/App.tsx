import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useSettings } from "./context/SettingsContext";
import CollapsibleNavSection from "./components/CollapsibleNavSection";
import Clock from "./components/Clock";
import ConnectionIndicator from "./components/ConnectionIndicator";

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
    title: "Finanzas",
    items: [
      { to: "/transactions/movements", label: "Movimientos", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/transactions/balances", label: "Saldos diarios", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/counterparts", label: "Contrapartes", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/transactions/participants", label: "Participantes", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/loans", label: "Préstamos", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/services", label: "Servicios", roles: ["GOD", "ADMIN", "ANALYST"] },
    ],
  },
  {
    title: "Gestión",
    items: [
      { to: "/inventory", label: "Inventario", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/supplies", label: "Solicitud de Insumos", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/employees", label: "Trabajadores", roles: ["GOD", "ADMIN"] },
      { to: "/timesheets", label: "Horas y pagos", roles: ["GOD", "ADMIN", "ANALYST"] },
    ],
  },
  {
    title: "Administración",
    items: [
      { to: "/upload", label: "Subir CSV", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/settings/general", label: "Config. general", roles: ["GOD", "ADMIN"] },
      { to: "/settings/accesos", label: "Accesos y conexiones", roles: ["GOD", "ADMIN"] },
      { to: "/settings/inventario", label: "Config. inventario", roles: ["GOD", "ADMIN"] },
      { to: "/settings/roles", label: "Roles y permisos", roles: ["GOD", "ADMIN"] },
    ],
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
  "/loans": "Préstamos y créditos",
  "/services": "Servicios recurrentes",
  "/data": "Movimientos registrados",
  "/stats": "Estadísticas",
  "/settings": "Configuración",
  "/settings/general": "Identidad y marca",
  "/settings/accesos": "Accesos y conexiones",
  "/settings/inventario": "Parámetros de inventario",
  "/settings/roles": "Roles y permisos",
  "/inventory": "Gestión de Inventario",
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

  const displayName = user?.name || (user?.email?.split("@")[0] ?? "");
  const capitalizedName = displayName.split(" ")[0].charAt(0).toUpperCase() + displayName.split(" ")[0].slice(1).toLowerCase();

  return (
    <div className="relative mx-auto flex min-h-screen max-w-[1440px] gap-6 px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <aside className="glass-panel glass-underlay-gradient flex w-64 flex-shrink-0 flex-col overflow-hidden rounded-3xl p-5 text-sm text-slate-700 shadow-xl">
        <div className="flex h-16 items-center justify-center rounded-2xl border border-white/40 bg-white/60 px-3 shadow-inner">
          <img src={settings.logoUrl} alt="Logo" className="h-10" />
        </div>
        <nav className="muted-scrollbar mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
          {navigation.map((section) => (
            <CollapsibleNavSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? "border-white/60 bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] shadow-[0_10px_30px_-20px_rgba(14,100,183,0.9)]"
                        : "border-transparent text-slate-600 hover:border-white/40 hover:bg-white/35 hover:text-[var(--brand-primary)]"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </CollapsibleNavSection>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col gap-6">
        <header className="glass-panel glass-panel--tinted flex items-center justify-between rounded-3xl px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-800 drop-shadow-sm">{title}</h1>
          <div className="flex items-center gap-4">
            <ConnectionIndicator />
            <div className="text-right">
              <p className="font-semibold text-slate-800">{capitalizedName}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 transition-all hover:scale-[1.02] hover:text-[var(--brand-primary)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V5h10a1 1 0 100-2H3zm12.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L16.586 13H9a1 1 0 110-2h7.586l-1.293-1.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="glass-panel flex-1 overflow-hidden rounded-3xl">
          <div className="muted-scrollbar h-full overflow-y-auto px-6 py-6">
            <Outlet />
          </div>
        </main>

        <footer className="glass-panel flex items-center justify-between rounded-3xl px-6 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-500">Bioalergia Finanzas</span>
          <Clock />
        </footer>
      </div>
    </div>
  );
}
