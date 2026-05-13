"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[15px] font-medium text-nocta-text-secondary mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-nocta-surface border border-nocta-border rounded-2xl px-5 py-4
          text-[16px] text-nocta-text placeholder-nocta-text-muted
          focus:outline-none focus:border-nocta-border-hover focus:bg-nocta-surface-hover
          transition-all duration-300
          ${error ? "border-nocta-danger/20 focus:border-nocta-danger/30" : ""}
          ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-2 text-[14px] text-nocta-danger/80">{error}</p>
      )}
    </div>
  );
}
