import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X, Zap } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'info' | 'decision' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ICONS = {
  success: <CheckCircle className="h-4 w-4 shrink-0" />,
  decision: <Zap className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  info: <Info className="h-4 w-4 shrink-0" />,
  error: <AlertTriangle className="h-4 w-4 shrink-0" />,
};

const STYLES = {
  success:  'bg-emerald-950 border-emerald-700 text-emerald-300',
  decision: 'bg-[#131C2E] border-[#97A3AE]/60 text-[#DCCCB4]',
  warning:  'bg-amber-950 border-amber-700 text-amber-300',
  info:     'bg-sky-950 border-sky-700 text-sky-300',
  error:    'bg-rose-950 border-rose-700 text-rose-300',
};

const AUTO_DISMISS_MS = 5000;

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss
    const leaveTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
    };
  }, [toast.id, onDismiss]);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`
        flex items-start gap-3 w-80 px-4 py-3 rounded-xl border shadow-2xl
        transition-all duration-300 ease-out
        ${STYLES[toast.type]}
        ${visible && !leaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <span className="mt-0.5">{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide opacity-70">{toast.title}</p>
        <p className="text-sm mt-0.5 leading-snug break-words">{toast.message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="mt-0.5 opacity-50 hover:opacity-100 transition-opacity shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
