import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { FileText, History, LayoutDashboard, ShieldAlert, FileOutput, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const isScanDetail = location.startsWith("/scan/") && location !== "/scan";
  const scanId = isScanDetail ? location.split("/")[2] : null;

  const handleGenerateReport = async () => {
    if (!scanId) return;
    setIsGenerating(true);
    try {
      const resp = await fetch(`/api/report/${scanId}?userId=demo-user`);
      if (!resp.ok) throw new Error("Failed to generate report");
      const data = await resp.json() as { reportBase64: string; filename: string };
      const link = document.createElement("a");
      link.href = `data:text/plain;base64,${data.reportBase64}`;
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

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-sidebar-primary">
            <ShieldAlert className="h-6 w-6" />
            <span>IndiePact AI</span>
          </Link>
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          <NavItem href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" active={location === "/dashboard"} />
          <NavItem href="/scan" icon={<FileText size={18} />} label="Document Lab" active={location === "/scan" || location.startsWith("/scan/")} />
          <NavItem href="/history" icon={<History size={18} />} label="Intelligence Vault" active={location === "/history"} />
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="font-medium text-sm text-muted-foreground flex items-center gap-2">
             <span>{location.split('/')[1]?.toUpperCase() || 'APP'}</span>
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
                Generate Report
              </Button>
            )}
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-mono text-sm font-bold border border-primary/30">
              DU
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
      active 
        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border" 
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
    }`}>
      {icon}
      {label}
    </Link>
  );
}
