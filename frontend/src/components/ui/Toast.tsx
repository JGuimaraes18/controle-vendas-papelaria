import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  ToastContext,
  type ToastContextValue,
  type ToastType,
} from "./toastContext";

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 1;
const ROUTE_TOAST_ID = -1;

const STYLE: Record<
  ToastType,
  { box: string; icon: ReactNode }
> = {
  success: {
    box: "bg-emerald-50/95 border-emerald-100 text-emerald-800 shadow-emerald-500/5",
    icon: <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
  },
  error: {
    box: "bg-rose-50/95 border-rose-100 text-rose-800 shadow-rose-500/5",
    icon: <AlertCircle size={15} className="text-rose-500 shrink-0" />,
  },
  warning: {
    box: "bg-amber-50/95 border-amber-100 text-amber-800 shadow-amber-500/5",
    icon: <AlertTriangle size={15} className="text-amber-500 shrink-0" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [dismissedRouteKeys, setDismissedRouteKeys] = useState<string[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = nextId++;
      setToasts((current) => [...current, { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 3500)
      );
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string) => show(message, "success"),
    [show]
  );
  const error = useCallback(
    (message: string) => show(message, "error"),
    [show]
  );

  const routeState = location.state as
    | { message?: string; type?: ToastType }
    | null
    | undefined;
  const routeKey = location.key;
  const routeMessage = routeState?.message;
  const routeType = routeState?.type ?? "success";
  const routeToastVisible =
    Boolean(routeMessage) && !dismissedRouteKeys.includes(routeKey);

  const dismissRouteToast = useCallback(() => {
    setDismissedRouteKeys((current) =>
      current.includes(routeKey) ? current : [...current, routeKey]
    );
  }, [routeKey]);

  useEffect(() => {
    if (!routeMessage) return;

    window.history.replaceState({}, document.title);

    if (!routeToastVisible) return;

    const timer = setTimeout(dismissRouteToast, 3500);

    return () => clearTimeout(timer);
  }, [routeMessage, routeToastVisible, dismissRouteToast]);

  useEffect(() => {
    const timer = timers.current;
    return () => {
      timer.forEach(clearTimeout);
    };
  }, []);

  const visibleToasts: ToastData[] =
    routeToastVisible && routeMessage
      ? [
          {
            id: ROUTE_TOAST_ID,
            message: routeMessage,
            type: routeType,
          },
          ...toasts,
        ]
      : toasts;

  const contextValue: ToastContextValue = { show, success, error };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 w-fit max-w-sm">
        {visibleToasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border shadow-lg backdrop-blur-sm ${STYLE[toast.type].box}`}
          >
            <span className="mt-px">{STYLE[toast.type].icon}</span>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => {
                if (toast.id === ROUTE_TOAST_ID) {
                  dismissRouteToast();
                } else {
                  dismiss(toast.id);
                }
              }}
              className="text-current/50 hover:text-current transition-colors"
              aria-label="Fechar"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
