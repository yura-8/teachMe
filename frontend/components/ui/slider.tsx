import * as React from "react";

import { cn } from "@/lib/utils";

type SliderProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> & {
  onValueChange?: (value: number) => void;
};

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, onValueChange, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="range"
        className={cn("w-full accent-[#FFF1C9]", className)}
        onChange={(e) => onValueChange?.(Number(e.target.value))}
        {...props}
      />
    );
  },
);
Slider.displayName = "Slider";
