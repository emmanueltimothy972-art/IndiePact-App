import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

const STEPS = [
  { label: "Extracting clause structure...", delay: 0 },
  { label: "Cross-referencing risk database...", delay: 900 },
  { label: "Isolating liability exposure...", delay: 1800 },
  { label: "Drafting strategic observations...", delay: 2600 },
];

const TOTAL_DURATION = 3200;

interface ForensicTraceProps {
  onComplete: () => void;
}

export function ForensicTrace({ onComplete }: ForensicTraceProps) {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((step, idx) => {
      timers.push(setTimeout(() => {
        setVisibleSteps((prev) => [...prev, idx]);
      }, step.delay));
    });

    timers.push(setTimeout(() => {
      onComplete();
    }, TOTAL_DURATION));

    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(dotInterval);
    };
  }, [onComplete]);

  return (
    <div className="mt-8 border border-primary/20 bg-[#0B0E14] rounded-xl p-8 animate-in fade-in duration-300">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="relative mb-5">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-30" />
        </div>
        <h3 className="text-xl font-bold tracking-tight mb-1">Forensic Trace Running</h3>
        <p className="text-muted-foreground text-sm">Analyzing your contract with military-grade precision{dots}</p>
      </div>

      <div className="max-w-sm mx-auto space-y-3">
        {STEPS.map((step, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 transition-all duration-500 ${
              visibleSteps.includes(idx) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            }`}
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${
              visibleSteps.includes(idx) ? "bg-primary" : "bg-muted"
            }`} />
            <span className={`text-sm font-mono ${
              visibleSteps.includes(idx) ? "text-foreground" : "text-muted-foreground"
            }`}>
              {step.label}
            </span>
            {visibleSteps.includes(idx) && (
              <span className="ml-auto text-primary text-xs font-mono">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
