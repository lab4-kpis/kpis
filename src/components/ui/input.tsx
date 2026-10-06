import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("flex h-9 w-full rounded-md border bg-card px-3 py-1 text-sm shadow-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className)}
    {...props}
  />
));
Input.displayName = "Input";
