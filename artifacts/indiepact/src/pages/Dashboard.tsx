import { PageTransition } from "@/components/PageTransition";
import { useGetDashboardSummary, useGetRiskTrends } from "@workspace/api-client-react";
import { getGetDashboardSummaryQueryKey, getGetRiskTrendsQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Shield, AlertTriangle, TrendingUp, DollarSign, Activity, LayoutDashboard, FileText, Zap, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { PLAN_DISPLAY_NAMES } from "@/lib/constants";

export default function Dashboard() {
  const { userId, userPlan, scansUsed, scansLimit, isGuest } = useAuth();

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary(
    { userId },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ userId }) } }
  );
  const { data: trends, isLoading: isTrendsLoading } = useGetRiskTrends(
    { userId, days: 30 },
    { query: { queryKey: getGetRiskTrendsQueryKey({ userId, days: 30 }) } }
  );

  const riskData = summary ? [
    { name: "High Risk", count: summary.highRiskCount, fill: "hsl(var(--destructive))" },
    { name: "Medium", count: summary.mediumRiskCount, fill: "hsl(var(--chart-3))" },
    { name: "Low Risk", count: summary.lowRiskCount, fill: "hsl(var(--chart-5))" },
  ] : [];

  const reviewsRemaining = isGuest ? scansLimit : Math.max(0, scansLimit - scansUsed);
  const isAtLimit = !isGuest && reviewsRemaining === 0;
  const planLabel = PLAN_DISPLAY_NAMES[userPlan] ?? "Free";

  return (
    <PageTransition className="space-y-6">
      {/* Page intro */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-emerald-950/60 border border-emerald-900/50 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Your contract review overview — money protected, risks found, and activity over time.</p>
            <p className="text-xs text-slate-600 mt-1 italic">Example: See how many high-risk clauses were flagged across all your contracts this month.</p>
          </div>
        </div>
        <Link href="/scan" className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors shrink-0 self-start md:self-center shadow-[0_0_12px_rgba(16,185,129,0.2)]">
          <FileText size={15} /> Review a Contract
        </Link>
      </div>

      {/* Upgrade banner when at limit */}
      {isAtLimit && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-amber-400 font-semibold text-sm mb-0.5">You've used all your reviews this month</p>
            <p className="text-slate-500 text-xs">Upgrade to keep reviewing contracts without interruption.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/pricing" className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors shadow-[0_0_12px_rgba(212,175,55,0.2)]">
              <Zap size={14} /> Upgrade Plan
            </Link>
            <Link href="/pricing" className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 whitespace-nowrap">
              Compare plans <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-4 p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-[0_0_15px_rgba(212,175,55,0.08)] flex flex-col justify-center items-center text-center">
          <h3 className="text-xs font-semibold text-amber-400/70 uppercase tracking-widest mb-2">Total Value Protected</h3>
          <div className="text-5xl font-bold font-mono tracking-tighter text-amber-400 mb-1">
            {isSummaryLoading ? "..." : `$${(summary?.totalMoneyProtected ?? 0).toLocaleString()}`}
          </div>
          <div className="text-sm text-slate-500">Estimated value of unfair clauses caught across all your reviews</div>
        </div>

        <StatCard
          title="Protection Score"
          value={isSummaryLoading ? "..." : `${(summary?.averageProtectionScore ?? 0).toFixed(0)}/100`}
          icon={<Shield className="text-emerald-400" size={18} />}
          desc="Average across all contracts"
        />
        <StatCard
          title="High-Risk Clauses"
          value={isSummaryLoading ? "..." : (summary?.highRiskCount ?? 0).toString()}
          icon={<AlertTriangle className="text-red-400" size={18} />}
          desc="Flagged as urgent to address"
        />
        <StatCard
          title="Total Reviews"
          value={isSummaryLoading ? "..." : (summary?.totalScans ?? 0).toString()}
          icon={<TrendingUp className="text-blue-400" size={18} />}
          desc="Contracts reviewed so far"
        />
        <StatCard
          title="Reviews Remaining"
          value={isGuest ? "—" : reviewsRemaining.toString()}
          icon={<Activity className={isAtLimit ? "text-amber-400" : "text-purple-400"} size={18} />}
          desc={isGuest ? "Sign in to track usage" : `${scansUsed}/${scansLimit} used · ${planLabel} plan`}
          highlight={isAtLimit}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-slate-800 bg-[#0a0a0a] rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-1">Risk trends over 30 days</h2>
          <p className="text-xs text-slate-500 mb-5">How different risk categories appeared across your recent reviews.</p>
          <div className="h-[260px] w-full">
            {isTrendsLoading ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm animate-pulse">Loading trends...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends?.trends || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "12px" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  <Line type="monotone" dataKey="scopeCreep" name="Scope Creep" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="liability" name="Liability" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="paymentDelay" name="Payment Delays" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="border border-slate-800 bg-[#0a0a0a] rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-1">Risk breakdown</h2>
          <p className="text-xs text-slate-500 mb-5">High, medium, and low risk clauses across all reviews.</p>
          <div className="h-[260px] w-full">
            {isSummaryLoading ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm animate-pulse">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} margin={{ top: 5, right: 0, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "12px" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function StatCard({
  title, value, icon, desc, highlight,
}: {
  title: string; value: string; icon: React.ReactNode; desc: string; highlight?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl border bg-[#0a0a0a] flex flex-col ${highlight ? "border-amber-500/30" : "border-slate-800"}`}>
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className="p-1.5 bg-slate-800/50 rounded-lg">{icon}</div>
      </div>
      <div className="text-3xl font-bold tracking-tight mb-1 font-mono text-white">{value}</div>
      <div className="text-xs text-slate-600">{desc}</div>
    </div>
  );
}
