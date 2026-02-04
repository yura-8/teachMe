import * as React from "react";

import { cn } from "@/lib/utils";

// Lightweight, dependency-free Select.
// (shadcn/ui typically uses Radix, but this keeps setup simple in this repo.)
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-zinc-900/15 bg-white px-3 text-sm text-zinc-900 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

