import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto rounded-lg border bg-card", className)}><table className="w-full border-collapse text-left text-sm">{children}</table></div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b bg-[#fafbfc] text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</thead>;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:not(:last-child)]:border-b", className)} {...props} />;
}

export function TableRow({ className, interactive = false, ...props }: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return <tr className={cn("transition-colors", interactive && "cursor-pointer hover:bg-[#fafbfc]", className)} {...props} />;
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-3 ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
