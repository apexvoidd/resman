"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "error" | "success" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    error: (message: string, title?: string, duration?: number) => void;
    success: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Global fallback listener for non-React contexts
let globalToastEmitter: ((toast: Omit<ToastMessage, "id">) => void) | null = null;

export const triggerGlobalToast = (
  type: ToastType,
  message: string,
  title?: string,
  duration = 4000
) => {
  if (globalToastEmitter) {
    globalToastEmitter({ type, title, message, duration });
  }
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4500) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 visible toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  // Register global emitter
  React.useEffect(() => {
    globalToastEmitter = (t) => addToast(t.type, t.message, t.title, t.duration);
    return () => {
      globalToastEmitter = null;
    };
  }, [addToast]);

  const contextValue: ToastContextType = {
    toast: {
      error: (msg, title, dur) => addToast("error", msg, title || "Error Alert", dur),
      success: (msg, title, dur) => addToast("success", msg, title || "Success", dur),
      warning: (msg, title, dur) => addToast("warning", msg, title || "Warning", dur),
      info: (msg, title, dur) => addToast("info", msg, title || "Notification", dur),
    },
    removeToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Floating Toast Overlay Container (Top on Mobile, Bottom-Right on Desktop) */}
      <div
        className="fixed top-3 left-3 right-3 sm:top-auto sm:left-auto sm:bottom-6 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100%-1.5rem)] sm:w-96 pointer-events-none mx-auto sm:mx-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 animate-in slide-in-from-top-4 sm:slide-in-from-bottom-5 fade-in ${
              t.type === "error"
                ? "bg-slate-900/95 border-red-500/40 text-red-100 shadow-red-500/20 ring-1 ring-red-500/30"
                : t.type === "success"
                ? "bg-slate-900/95 border-emerald-500/40 text-emerald-100 shadow-emerald-500/20 ring-1 ring-emerald-500/30"
                : t.type === "warning"
                ? "bg-slate-900/95 border-amber-500/40 text-amber-100 shadow-amber-500/20 ring-1 ring-amber-500/30"
                : "bg-slate-900/95 border-sky-500/40 text-sky-100 shadow-sky-500/20 ring-1 ring-sky-500/30"
            }`}
          >
            {/* Icon */}
            <div className="mt-0.5 shrink-0">
              {t.type === "error" && (
                <AlertCircle className="h-5 w-5 text-red-400 animate-pulse" />
              )}
              {t.type === "success" && (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              )}
              {t.type === "warning" && (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              {t.type === "info" && <Info className="h-5 w-5 text-sky-400" />}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-0.5 pr-2 overflow-hidden">
              {t.title && (
                <h4
                  className={`text-xs font-bold tracking-tight uppercase ${
                    t.type === "error"
                      ? "text-red-300"
                      : t.type === "success"
                      ? "text-emerald-300"
                      : t.type === "warning"
                      ? "text-amber-300"
                      : "text-sky-300"
                  }`}
                >
                  {t.title}
                </h4>
              )}
              <p className="text-xs font-medium leading-relaxed break-words text-slate-200">
                {t.message}
              </p>
            </div>

            {/* Dismiss Close Button */}
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg transition"
              aria-label="Close Toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}
