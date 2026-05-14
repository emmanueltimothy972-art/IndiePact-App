import { DEV_AUTH_BYPASS } from "@/lib/devMode";
import { useAuth } from "@/contexts/AuthContext";
import { FlaskConical } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/constants";

const TIERS: { key: string; label: string; color: string; activeColor: string }[] = [
  { key: "free",     label: "FREE",     color: "text-slate-400",  activeColor: "bg-slate-700 text-white border-slate-500" },
  { key: "starter",  label: "STARTER",  color: "text-blue-400",   activeColor: "bg-blue-950 text-blue-300 border-blue-700" },
  { key: "pro",      label: "PRO",      color: "text-amber-400",  activeColor: "bg-amber-950 text-amber-300 border-amber-700" },
  { key: "business", label: "BIZ",      color: "text-emerald-400",activeColor: "bg-emerald-950 text-emerald-300 border-emerald-700" },
];

export function TierSwitcher() {
  const { devTier, setDevTier } = useAuth();

  if (!DEV_AUTH_BYPASS) return null;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-violet-800/40 bg-violet-950/30 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <FlaskConical size={12} className="text-violet-400 shrink-0" />
        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest leading-none">
          Tier Simulator
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {TIERS.map((tier) => {
          const isActive = devTier === tier.key;
          return (
            <button
              key={tier.key}
              onClick={() => setDevTier(tier.key)}
              title={`Simulate ${tier.label} plan — ${PLAN_LIMITS[tier.key] ?? "?"} scans/mo`}
              className={`py-1.5 rounded-md border text-[9px] font-bold tracking-widest transition-all ${
                isActive
                  ? tier.activeColor
                  : "border-violet-900/40 text-slate-600 hover:border-violet-700/50 hover:text-slate-400 bg-transparent"
              }`}
            >
              {tier.label}
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-violet-800 leading-tight font-mono">
        Active: <span className="text-violet-500 font-bold">{devTier.toUpperCase()}</span>
        {" "}· {PLAN_LIMITS[devTier] ?? "?"} scans/mo · Feature gates update live
      </p>
    </div>
  );
}
