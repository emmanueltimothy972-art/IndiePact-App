import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  FileText, History, LayoutDashboard, ShieldCheck,
  FileOutput, Loader2, Menu, Scale, Shield, MessageSquare, Lock,
  LogIn, LogOut, Brain,
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, userId, isGuest, openAuthModal, signOut, isLoading } = useAuth();
  const isScanDetail = location.startsWith("/scan/") && location !== "/scan";
  const scanId = isScanDetail ? location.split("/")[2] : null;

  const handleGenerateReport = async () => {
    if (!scanId) return;
    if (isGuest) { openAuthModal(); return; }
    setIsGenerating(true);
    try {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const resp = await fetch(`${base}/api/report/${scanId}?userId=${userId}`);
      if (!resp.ok) throw new Error("Failed to generate report");
      const data = await resp.json() as { reportBase64: string; filename: string };
      const link = document.createElement("a");
      const mime = data.filename.endsWith(".html") ? "text/html" : "text/plain";
      link.href = `data:${mime};base64,${data.reportBase64}`;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Report generation failed:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (location === "/" || location === "/pricing") return <>{children}</>;

  const userInitial = user?.email ? user.email[0].toUpperCase() : null;

  const NAV_ITEMS = [
    { href: "/dashboard", icon: <LayoutDashboard size={17} />, label: "Dashboard", sub: "Your overview" },
    { href: "/scan", icon: <FileText size={17} />, label: "Review Contract", sub: "Analyze a contract" },
    { href: "/history", icon: <History size={17} />, label: "My Reviews", sub: "Past contract reviews" },
    { href: "/escrow", icon: <Lock size={17} />, label: "Payment Lock", sub: "Protect your payments" },
    { href: "/legal-strategy", icon: <Brain size={17} />, label: "AI Legal Strategy", sub: "Negotiation planning", isNew: true },
    { href: "/bar", icon: <Scale size={17} />, label: "AI Attorney", sub: "Deep legal strategy", isPro: true },
    { href: "/armory", icon: <Shield size={17} />, label: "Clause Library", sub: "Saved clauses & fixes" },
    { href: "/negotiator", icon: <MessageSquare size={17} />, label: "Negotiation Room", sub: "AI negotiation coach" },
  ];

  const NavItems = ({ onClose }: { onClose?: () => void }) => (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/scan"
          ? location === "/scan" || location.startsWith("/scan/")
          : location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
              active
                ? "bg-emerald-950/50 text-emerald-300 border border-emerald-900/50"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"}>
                {item.icon}
              </span>
              <div>
                <div className="leading-tight">{item.label}</div>
                <div className={`text-[10px] leading-tight mt-0.5 ${active ? "text-emerald-600" : "text-slate-600"}`}>
                  {item.sub}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {item.isNew && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  NEW
                </span>
              )}
              {item.isPro && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  PRO
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 border-r border-border bg-sidebar flex-col">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <span>IndiePact</span>
          </Link>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-1 px-3 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 pt-2 pb-1">
            Tools
          </p>
          <NavItems />
        </nav>

        {/* Sidebar auth */}
        <div className="border-t border-border p-3">
          {!isLoading && (
            isGuest ? (
              <button
                onClick={openAuthModal}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400/80 hover:bg-emerald-950/30 hover:text-emerald-300 transition-all border border-emerald-900/30 hover:border-emerald-800/50"
              >
                <LogIn size={15} />
                Sign In to Save Progress
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/30">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0">
                    {userInitial}
                  </div>
                  <span className="text-xs text-slate-400 truncate">{user?.email}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-300 hover:bg-slate-800/30 transition-colors"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-14 border-b border-border bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-sidebar border-r border-border flex flex-col">
                <div className="h-14 flex items-center px-5 border-b border-border">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 font-bold text-base text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                    IndiePact
                  </Link>
                </div>
                <nav className="flex-1 py-3 flex flex-col gap-1 px-3 overflow-y-auto">
                  <NavItems onClose={() => setMobileMenuOpen(false)} />
                </nav>
                <div className="border-t border-border p-3">
                  {isGuest ? (
                    <button onClick={() => { setMobileMenuOpen(false); openAuthModal(); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-emerald-400 border border-emerald-900/40">
                      <LogIn size={15} /> Sign In
                    </button>
                  ) : (
                    <button onClick={() => { setMobileMenuOpen(false); signOut(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300">
                      <LogOut size={13} /> Sign Out
                    </button>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <div className="text-sm font-medium text-muted-foreground capitalize">
              {NAV_ITEMS.find(n => n.href === (location.startsWith("/scan/") ? "/scan" : location))?.label || "App"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isScanDetail && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="gap-2 h-8 text-xs"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileOutput className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Download Report</span>
              </Button>
            )}

            {!isLoading && (
              isGuest ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openAuthModal}
                  className="gap-1.5 h-8 text-xs border-emerald-800/50 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-700"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    title={user?.email}
                    className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-300 font-bold text-sm border border-emerald-500/20 cursor-default"
                  >
                    {userInitial}
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="hidden sm:flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
