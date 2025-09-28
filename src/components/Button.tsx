import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg" | "xs";
}

export default function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 backdrop-blur-sm";

  const variantClasses: Record<Required<ButtonProps>["variant"], string> = {
    primary:
      "bg-[var(--brand-primary)]/95 text-white shadow-[0_16px_30px_-18px_rgba(14,100,183,0.9)] hover:bg-[var(--brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(var(--brand-primary-rgb)/0.55)]",
    secondary:
      "border border-white/60 bg-white/65 text-slate-700 shadow-[0_12px_28px_-16px_rgba(16,37,66,0.28)] hover:bg-white/80 hover:text-[var(--brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(var(--brand-primary-rgb)/0.35)]",
  };

  const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
    xs: "px-2.5 py-1 text-xs",
    sm: "px-3.5 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-[1.75rem] py-3 text-base",
  };

  return (
    <button
      {...props}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
    />
  );
}
