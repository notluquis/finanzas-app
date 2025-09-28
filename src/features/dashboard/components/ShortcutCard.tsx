import { Link } from "react-router-dom";

export default function ShortcutCard({
  title,
  description,
  to,
  accent,
}: {
  title: string;
  description: string;
  to: string;
  accent: "primary" | "secondary";
}) {
  const accentColor = accent === "primary" ? "var(--brand-primary)" : "var(--brand-secondary)";
  const accentTint = accent === "primary" ? "rgba(14, 100, 183, 0.15)" : "rgba(241, 167, 34, 0.18)";

  return (
    <article className="glass-card glass-underlay-gradient flex flex-col justify-between p-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: accentColor }}>
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600/90">{description}</p>
      </div>
      <Link
        to={to}
        className="mt-5 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(16,37,66,0.5)] transition hover:translate-y-[1px]"
        style={{ backgroundColor: accentColor, boxShadow: `0 16px 32px -20px ${accentTint}` }}
      >
        Abrir
      </Link>
    </article>
  );
}
