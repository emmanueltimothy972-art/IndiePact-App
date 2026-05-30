import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

const STEPS = [
  { label: "Parsing clause structure", delay: 0 },
  { label: "Scanning payment risk indicators", delay: 700 },
  { label: "Analyzing IP and ownership terms", delay: 1400 },
  { label: "Reviewing liability exposure", delay: 2100 },
  { label: "Evaluating termination clauses", delay: 2700 },
  { label: "Calculating protection score", delay: 3200 },
  { label: "Compiling strategic recommendations", delay: 3700 },
];

const TOTAL_DURATION = 4200;

interface ForensicTraceProps {
  onComplete: () => void;
}

export function ForensicTrace({ onComplete }: ForensicTraceProps) {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((step, idx) => {
      timers.push(
        setTimeout(() => {
          setVisibleSteps((prev) => [...prev, idx]);
        }, step.delay),
      );
    });

    timers.push(
      setTimeout(() => {
        onComplete();
      }, TOTAL_DURATION),
    );

    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(dotInterval);
    };
  }, [onComplete]);

  const progress = Math.round((visibleSteps.length / STEPS.length) * 100);

  return (
    <div className="mt-8 border border-emerald-900/30 bg-[#080d0a] rounded-2xl p-8 animate-in fade-in duration-300">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="relative mb-5">
          <div className="h-14 w-14 rounded-full bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-emerald-400 animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border border-emerald-700/20 animate-ping opacity-20" />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-slate-100 mb-1">
          Analyzing Contract
        </h3>
        <p className="text-slate-500 text-sm">
          Running forensic analysis{dots}
        </p>
      </div>

      {/* Progress bar */}
      <div className="max-w-sm mx-auto mb-6">
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-[10px] text-slate-600 mt-1 font-mono">{progress}%</p>
      </div>

      <div className="max-w-sm mx-auto space-y-2.5">
        {STEPS.map((step, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 transition-all duration-500 ${
              visibleSteps.includes(idx)
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-4"
            }`}
          >
            <div
              className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors duration-300 ${
                visibleSteps.includes(idx) ? "bg-emerald-500" : "bg-slate-700"
              }`}
            />
            <span
              className={`text-sm font-mono tracking-tight ${
                visibleSteps.includes(idx) ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {step.label}
            </span>
            {visibleSteps.includes(idx) && (
              <span className="ml-auto text-emerald-500 text-xs font-mono">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
