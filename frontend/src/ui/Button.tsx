import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: "primary" | "secondary" | "danger";
};

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const variantClass = variant === "secondary" ? "uiButtonSecondary" : variant === "danger" ? "uiButtonDanger" : "uiButtonPrimary";
  return (
    <button className={`uiButton ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
