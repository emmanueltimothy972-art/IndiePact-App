import { ReactNode, useState } from "react";
import { DEMO_USER_ID } from "@/lib/constants";
import { Link, useLocation } from "wouter";
import {
  FileText, History, LayoutDashboard, ShieldAlert,
  FileOutput, Loader2, Menu, Scale, Shield, MessageSquare, Lock,
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isScanDetail = location.startsWith("/scan/") && location !== "/scan";
  const scanId = isScanDetail ? location.split("/")[2] : null;

  const handleGenerateReport = async () => {
    if (!scanId) return;
    setIsGenerating(true);
    try {
      const resp = await fetch(`/api/report/${scanId}?userId=${DEMO_USER_ID}`);
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

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
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
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r-border">
                <div className="h-16 flex items-center px-6 border-b border-border">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 font-bold text-lg tracking-tight text-primary">
                    <ShieldAlert className="h-6 w-6" />
                    <span>IndiePact AI</span>
                  </Link>
                </div>
                <nav className="py-4 flex flex-col gap-1 px-3">
                  <NavItems />
                </nav>
              </SheetContent>
            </Sheet>
            <div className="font-medium text-sm text-muted-foreground">
              <span>{location.split("/")[1]?.toUpperCase() || "APP"}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-mono text-sm font-bold border border-primary/30">
              DU
            </div>
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
