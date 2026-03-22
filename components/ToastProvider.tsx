"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Toast = { id: number; message: string; tone?: "default" | "success" | "warn" };

const ToastCtx = createContext<{
  toast: (message: string, tone?: Toast["tone"]) => void;
} | null>(null);

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToast must be used within ToastProvider");
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "default") => {
    const id = Date.now();
    setItems((s) => [...s, { id, message, tone }]);
    setTimeout(() => {
      setItems((s) => s.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-[8px] border border-border-card px-4 py-3 text-[13px] font-medium ${
              t.tone === "success"
                ? "bg-bg-deep text-accent-green"
                : t.tone === "warn"
                  ? "bg-bg-deep text-accent-amber"
                  : "bg-bg-card text-text-secondary"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
