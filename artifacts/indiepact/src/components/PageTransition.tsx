import { ReactNode } from "react";

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`animate-in fade-in duration-150${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
