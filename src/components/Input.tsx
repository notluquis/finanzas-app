import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  type?: string;
  rows?: number;
}

export default function Input(props: InputProps) {
  const { label, helper, type = "text", rows = 3, className = "", children, ...rest } = props;
  const sharedClasses = `glass-input w-full ${className}`.trim();

  const labelClasses = "flex flex-col gap-2 text-sm text-slate-600";
  const labelTextClasses = "text-xs font-semibold uppercase tracking-wide text-slate-600/90";
  const helperClasses = "text-xs text-slate-500/80";

  let control: React.ReactNode;

  if (type === "textarea") {
    control = (
      <textarea
        rows={rows}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        className={sharedClasses}
      />
    );
  } else if (type === "select") {
    control = (
      <select
        {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
        className={`${sharedClasses} pr-8`}
      >
        {children}
      </select>
    );
  } else {
    control = (
      <input
        type={type}
        {...rest}
        className={sharedClasses}
      />
    );
  }

  return (
    <label className={labelClasses}>
      {label && <span className={labelTextClasses}>{label}</span>}
      {control}
      {helper && <span className={helperClasses}>{helper}</span>}
    </label>
  );
}
