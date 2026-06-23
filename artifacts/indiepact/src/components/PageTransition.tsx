import { ReactNode } from "react";

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    /*
     * isolate creates a new stacking context so the fade-in animation's
     * compositing layer doesn't bleed into or above the Layout's z-10
     * sticky header. Without it, animated opacity on a flex child can
     * produce GPU layer ordering issues that corrupt desktop rendering.
     */
    <div className={`animate-in fade-in duration-150 isolate${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
