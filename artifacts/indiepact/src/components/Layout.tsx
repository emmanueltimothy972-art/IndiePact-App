import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  FileText, History, LayoutDashboard, ShieldAlert,
  FileOutput, Loader2, Menu, Scale, Shield, MessageSquare, Lock,
  LogIn, LogOut, UserCircle2,
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
      const resp = await fetch(`/api/report/${scanId}?userId=${userId}`);
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

  if (location === "/") return <>{children}</>;

  const NavItems = () => (
    <>
      <NavItem href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" active={location === "/dashboard"} onClick={() => setMobileMenuOpen(false)} />
      <NavItem href="/scan" icon={<FileText size={18} />} label="Document Lab" active={location === "/scan" || location.startsWith("/scan/")} onClick={() => setMobileMenuOpen(false)} />
      <NavItem href="/history" icon={<History size={18} />} label="Intelligence Vault" active={location === "/history"} onClick={() => setMobileMenuOpen(false)} />
      <NavItem href="/escrow" icon={<Lock size={18} />} label="Escrow Lock" active={location === "/escrow"} onClick={() => setMobileMenuOpen(false)} />
      <NavItem href="/bar" icon={<Scale size={18} />} label="The Bar" active={location === "/bar"} isPro onClick={() => setMobileMenuOpen(false)} />
      <NavItem href="/armory" icon={<Shield size={18} />} label="Clause Armory" active={location === "/armory"} onClick={() => setMobileMenuOpen(false)} />
      <NavItem href="/negotiator" icon={<MessageSquare size={18} />} label="Shadow Negotiator" active={location === "/negotiator"} onClick={() => setMobileMenuOpen(false)} />
    </>
  );

  const userInitial = user?.email ? user.email[0].toUpperCase() : null;

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="hidden lg:flex w-64 border-r border-border bg-sidebar flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-primary">
            <ShieldAlert className="h-6 w-6" />
            <span>IndiePact AI</span>
          </Link>
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          <NavItems />
        </nav>

        {/* Sidebar auth section */}
        <div className="border-t border-border p-3">
          {!isLoading && (
            isGuest ? (
              <button
                onClick={openAuthModal}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-primary/80 hover:bg-sidebar-accent/50 hover:text-primary transition-colors border border-primary/20 hover:border-primary/40"
              >
                <LogIn size={16} />
                <span>Sign In / Register</span>
              </button>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/40">
                  <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-mono text-xs font-bold shrink-0">
                    {userInitial}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono truncate">{user?.email}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors font-mono"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r-border flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-border">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 font-bold text-lg tracking-tight text-primary">
                    <ShieldAlert className="h-6 w-6" />
                    <span>IndiePact AI</span>
                  </Link>
                </div>
                <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
                  <NavItems />
                </nav>
                <div className="border-t border-border p-3">
                  {isGuest ? (
                    <button onClick={() => { setMobileMenuOpen(false); openAuthModal(); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-primary font-medium border border-primary/20">
                      <LogIn size={16} /> Sign In
                    </button>
                  ) : (
                    <button onClick={() => { setMobileMenuOpen(false); signOut(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground font-mono hover:text-foreground">
                      <LogOut size={14} /> Sign Out ({user?.email})
                    </button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <div className="font-medium text-sm text-muted-foreground">
              <span>{location.split("/")[1]?.toUpperCase() || "APP"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isScanDetail && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />}
                <span className="hidden sm:inline">Generate Report</span>
              </Button>
            )}

            {!isLoading && (
              isGuest ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openAuthModal}
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 font-mono text-xs"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Login
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    title={user?.email}
                    className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-mono text-sm font-bold border border-primary/30 cursor-default"
                  >
                    {userInitial}
                  </div>
                  <button
                    onClick={() => signOut()}
                    title="Sign out"
                    className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Sign Out</span>
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

function NavItem({
  href, icon, label, active, isPro, onClick,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  isPro?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {isPro && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
          PRO
        </span>
      )}
    </Link>
  );
}
