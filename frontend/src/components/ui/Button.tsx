"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import React from "react";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "google";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary:
    "bg-nocta-accent text-white hover:brightness-110 shadow-[0_0_20px_rgba(168,158,200,0.2)] hover:shadow-[0_0_25px_rgba(168,158,200,0.3)] border border-white/10",
  secondary:
    "bg-white/10 hover:bg-white/15 text-nocta-text border border-white/10 backdrop-blur-sm",
  ghost:
    "bg-transparent hover:bg-white/5 text-nocta-text-secondary hover:text-nocta-text",
  danger:
    "bg-nocta-danger/10 hover:bg-nocta-danger/20 text-nocta-danger border border-nocta-danger/20",
  google:
    "bg-white text-gray-900 hover:bg-gray-50 border border-gray-200 shadow-sm",
};

const sizeStyles = {
  sm: "px-4 py-2 text-[14px] rounded-xl",
  md: "px-6 py-3 text-[15px] rounded-xl",
  lg: "px-8 py-4 text-[16px] rounded-2xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`font-semibold transition-all duration-300 cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
        flex items-center justify-center gap-2
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className={`w-3.5 h-3.5 border-[1.5px] rounded-full animate-spin
            ${variant === 'google' ? 'border-gray-200 border-t-gray-600' : 'border-white/30 border-t-white'}`} 
          />
          {children}
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}
