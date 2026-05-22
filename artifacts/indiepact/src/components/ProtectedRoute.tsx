import { ReactNode } from "react";
import { Loader2, ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isGuest, openAuthModal } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-slate-600 animate-spin" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center text-center max-w-sm space-y-5">
          <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-slate-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1.5">
              Sign in to continue
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              IndiePact is free to start. Create your account to access this
              feature.
            </p>
          </div>
          <button
            onClick={() => openAuthModal()}
            className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-700">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> Secure
            </span>
            <span>·</span>
            <span>No password</span>
            <span>·</span>
            <span>No spam</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
