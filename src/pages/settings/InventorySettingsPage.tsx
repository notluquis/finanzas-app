import InventoryCategoryManager from "../../features/inventory/components/InventoryCategoryManager";

export default function InventorySettingsPage() {
  return (
    <div className="space-y-6">
      <section className="glass-card glass-underlay-gradient space-y-2 p-6">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)] drop-shadow-sm">Parámetros de inventario</h2>
        <p className="text-sm text-slate-600/90">
          Gestiona las categorías y clasificaciones que usarán los equipos al registrar insumos y activos.
        </p>
      </section>

      <InventoryCategoryManager />
    </div>
  );
}
