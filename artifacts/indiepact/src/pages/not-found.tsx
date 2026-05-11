import { Link } from "wouter";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="max-w-md w-full flex flex-col items-center text-center gap-7"
      >
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
            border: "1px solid rgba(16,185,129,0.3)",
            boxShadow: "0 0 32px rgba(16,185,129,0.12)",
          }}
        >
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
        </div>

        <div className="space-y-3">
          <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">404</p>
          <h1 className="text-white text-2xl font-bold tracking-tight">Page not found</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            This page doesn't exist or has been moved. Head back to IndiePact to keep your contracts safe.
          </p>
        </div>

        <Link href="/">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:shadow-[0_0_24px_rgba(16,185,129,0.4)]">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </Link>
      </motion.div>
    </div>
  );
}
