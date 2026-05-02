import { DEMO_USER_ID } from "@/lib/constants";
import { PageTransition } from "@/components/PageTransition";
import { useGetDashboardSummary, useGetRiskTrends } from "@workspace/api-client-react";
import { getGetDashboardSummaryQueryKey, getGetRiskTrendsQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Shield, AlertTriangle, AlertCircle, CheckCircle, TrendingUp, DollarSign, Activity } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary(
    { userId: DEMO_USER_ID },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ userId: DEMO_USER_ID }) } }
  );

  const { data: trends, isLoading: isTrendsLoading } = useGetRiskTrends(
    { userId: DEMO_USER_ID, days: 30 },
    { query: { queryKey: getGetRiskTrendsQueryKey({ userId: DEMO_USER_ID, days: 30 }) } }
  );

  const riskData = summary ? [
    { name: "High Risk", count: summary.highRiskCount, fill: "hsl(var(--destructive))" },
    { name: "Medium Risk", count: summary.mediumRiskCount, fill: "hsl(var(--chart-3))" },
    { name: "Low Risk", count: summary.lowRiskCount, fill: "hsl(var(--chart-5))" },
  ] : [];

  return (
    <PageTransition className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Health</h1>
          <p className="text-muted-foreground mt-1">Overview of your protected revenue and scan history.</p>
        </div>
        <Link href="/scan" className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-colors flex items-center gap-2">
          <Activity size={16} /> New Scan
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Protected" 
          value={isSummaryLoading ? "..." : `$${summary?.totalMoneyProtected.toLocaleString()}`} 
          icon={<DollarSign className="text-emerald-400" />}
          desc="Revenue secured"
        />
        <StatCard 
          title="Avg Protection Score" 
          value={isSummaryLoading ? "..." : `${summary?.averageProtectionScore.toFixed(1)}/100`} 
          icon={<Shield className="text-primary" />}
          desc="Across all contracts"
        />
        <StatCard 
          title="Critical Risks Found" 
          value={isSummaryLoading ? "..." : summary?.highRiskCount.toString() || "0"} 
          icon={<AlertTriangle className="text-destructive" />}
          desc="Requiring immediate action"
        />
        <StatCard 
          title="Total Scans" 
          value={isSummaryLoading ? "..." : summary?.totalScans.toString() || "0"} 
          icon={<TrendingUp className="text-chart-2" />}
          desc="Documents analyzed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-border bg-card rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6">Risk Category Trends (30 Days)</h2>
          <div className="h-[300px] w-full">
            {isTrendsLoading ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground animate-pulse">Loading trends...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends?.trends || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                  <Line type="monotone" dataKey="scopeCreep" name="Scope Creep" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="liability" name="Liability" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="paymentDelay" name="Payment Delay" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6">Risk Distribution</h2>
          <div className="h-[300px] w-full">
            {isSummaryLoading ? (
               <div className="h-full w-full flex items-center justify-center text-muted-foreground animate-pulse">Loading distribution...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} margin={{ top: 5, right: 0, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function StatCard({ title, value, icon, desc }: { title: string, value: string, icon: React.ReactNode, desc: string }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="p-2 bg-muted rounded-md">{icon}</div>
      </div>
      <div className="text-3xl font-bold tracking-tight mb-1 font-mono">{value}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
