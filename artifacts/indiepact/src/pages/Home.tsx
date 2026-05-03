import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <PageTransition className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <ShieldAlert className="h-6 w-6" />
          <span>IndiePact AI</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center pt-32 pb-32 px-6">
        <div className="max-w-4xl w-full text-center space-y-8 relative">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
            Turn Fine Print Into <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Dollar Signs.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The contract scanning co-pilot for independent professionals. We surface financial and legal risk before the client can exploit it. Like having a sharp lawyer and a CFO looking over your shoulder at 2am.
          </p>

          <div className="flex flex-col items-center justify-center pt-8">
            <Link href="/scan">
              <Button size="lg" className="h-14 px-10 text-lg font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] w-full sm:w-auto">
                Enter the Command Center
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-16 pt-8 border-t border-border/50 text-sm font-medium text-muted-foreground">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-foreground">12,400+</span>
              <span>Clauses Analyzed</span>
            </div>
            <div className="hidden sm:block h-12 w-px bg-border/50"></div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-[#D4AF37]">$8.2M</span>
              <span>Capital Protected</span>
            </div>
            <div className="hidden sm:block h-12 w-px bg-border/50"></div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-foreground">99.1%</span>
              <span>Catch Rate</span>
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}