import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { ShieldAlert, FileSearch, ArrowRight, Zap, Target, Lock } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <PageTransition className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <ShieldAlert className="h-6 w-6" />
          <span>IndiePact AI</span>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/scan" className="text-muted-foreground hover:text-foreground transition-colors">Product</Link>
          <span className="text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed">Manifesto</span>
          <span className="text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed">Pricing</span>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" className="font-mono text-xs hidden sm:flex">Login</Button>
          </Link>
          <Link href="/scan">
            <Button className="font-mono text-xs shadow-[0_0_15px_rgba(0,200,255,0.3)] hover:shadow-[0_0_25px_rgba(0,200,255,0.5)] transition-shadow">Deploy Weapon</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center pt-24 pb-32 px-6">
        <div className="max-w-4xl w-full text-center space-y-8 relative">
          {/* Subtle grid background */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-4">
            <Zap size={14} />
            <span>v1.0.0 — Forensic Engine Active</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
            Turn Fine Print Into <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Dollar Signs.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The contract scanning co-pilot for independent professionals. We surface financial and legal risk before the client can exploit it. Like having a sharp lawyer and a CFO looking over your shoulder at 2am.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link href="/scan">
              <Button size="lg" className="h-12 px-8 text-base font-bold shadow-[0_0_20px_rgba(0,200,255,0.4)] hover:shadow-[0_0_30px_rgba(0,200,255,0.6)] w-full sm:w-auto">
                Start Scanning
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base w-full sm:w-auto border-muted-foreground/30 hover:bg-muted/50">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full mt-32">
          <FeatureCard 
            icon={<Target className="h-8 w-8 text-primary" />}
            title="Surgical Precision"
            desc="Our engine reads like a veteran litigator. It finds scope creep, liability traps, and hidden IP transfers instantly."
          />
          <FeatureCard 
            icon={<FileSearch className="h-8 w-8 text-primary" />}
            title="Actionable Rebuttals"
            desc="Don't just find problems. Get copy-paste ready rewrites in direct, diplomatic, or legal tones to send straight to the client."
          />
          <FeatureCard 
            icon={<Lock className="h-8 w-8 text-primary" />}
            title="Revenue Protection"
            desc="Quantify the exact dollar amount at risk in every contract. Know what you're signing away before ink meets paper."
          />
        </div>
      </main>
    </PageTransition>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm flex flex-col gap-4 hover:border-primary/50 transition-colors">
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
