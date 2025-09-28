import { useState } from "react";

export function DevHelpPopover() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="glass-card glass-underlay-gradient flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-2 text-xs font-medium text-slate-600 shadow-lg transition hover:border-white/80 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(14,100,183,0.35)]"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-secondary)] shadow-inner" />
        <span>Ayuda conexión</span>
      </button>
      {open && (
        <div className="mt-3 w-80 text-sm">
          <div className="glass-card glass-underlay-gradient space-y-3 rounded-2xl p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-700">Pasos de depuración</h3>
            <ol className="list-decimal space-y-2 pl-4 text-xs text-slate-600">
              <li>Verifica que <code>npm run server</code> esté activo y muestre <strong>Servidor API escuchando</strong>.</li>
              <li>Ejecuta <code>curl -v http://localhost:4000/api/health</code> para confirmar respuesta.</li>
              <li>Desde otra terminal levanta el front con <code>npm run dev</code>.</li>
              <li>Comprueba en consola que <code>/api/health</code> devuelve <code>status: "ok"</code>.</li>
              <li>Si ves "Fetch is aborted", ajusta <code>VITE_AUTH_TIMEOUT</code> y revisa la conexión a la base.</li>
            </ol>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Recuerda cerrar procesos duplicados de <code>tsx watch</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DevHelpPopover;
