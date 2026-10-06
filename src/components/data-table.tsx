import type { ReactNode } from "react";

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-left text-sm">{children}</table></div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b bg-[#fafbfc] text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</thead>;
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-3 ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b px-4 py-3 align-middle last:border-b-0 ${className}`}>{children}</td>;
}
