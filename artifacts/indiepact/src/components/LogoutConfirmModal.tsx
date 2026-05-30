import { useState } from "react";
import { LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface LogoutConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function LogoutConfirmModal({ open, onClose, onConfirm }: LogoutConfirmModalProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    if (isPending) return;
    setIsPending(true);
    // Dismiss the modal immediately — the user should never see a stuck
    // "Signing out…" dialog. signOut continues in the background.
    onClose();
    try {
      await onConfirm();
    } finally {
      setIsPending(false);
    }
  }

  // Allow ESC and outside-click to close at any time (no isPending guard).
  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] rounded-xl border border-slate-700/60 bg-slate-900 p-0 shadow-2xl gap-0 [&>button]:hidden">
        {/* Icon row */}
        <div className="flex items-center justify-center pt-8 pb-1">
          <div className="h-11 w-11 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center">
            <LogOut size={18} className="text-slate-400" />
          </div>
        </div>

        {/* Copy */}
        <DialogHeader className="px-6 pt-4 pb-6 text-center space-y-2">
          <DialogTitle className="text-base font-semibold text-slate-100 tracking-tight text-center">
            Log out of IndiePact?
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 leading-relaxed text-center">
            You'll need to sign in again to access your contract workspace and analysis history.
          </DialogDescription>
        </DialogHeader>

        {/* Divider */}
        <div className="h-px bg-slate-800 mx-0" />

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 p-4">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 bg-slate-800/60 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600/60 transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-100 bg-slate-700 hover:bg-slate-600 border border-slate-600/60 hover:border-slate-500/60 transition-all duration-150 disabled:pointer-events-none disabled:opacity-60 flex items-center justify-center gap-2"
          >
            Log Out
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
