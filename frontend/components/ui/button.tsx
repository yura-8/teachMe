import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "sm" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClass =
      variant === "secondary"
        ? "bg-[#FFF1C9] text-zinc-900 hover:bg-[#FFF1C9]/80"
        : variant === "outline"
          ? "border border-zinc-900/15 bg-[#FFF1C9] text-zinc-900 hover:bg-[#FFF1C9]/80"
          : "bg-[#FFF1C9] text-zinc-900 hover:bg-[#FFF1C9]/80";

    const sizeClass =
      size === "sm"
        ? "h-9 px-3 text-sm"
        : size === "lg"
          ? "h-11 px-5 text-base"
          : "h-10 px-4 text-sm";

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-2",
          variantClass,
          sizeClass,
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
