import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-zinc-900/15 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:ring-offset-2",
        "placeholder:text-zinc-900/40",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

