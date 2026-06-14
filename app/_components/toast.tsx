"use client";

import { useEffect, useState } from "react";
import type { ToastState } from "@/app/_types/payment";

type ToastProps = {
  toast: NonNullable<ToastState>;
  onDismiss: () => void;
};

export const Toast = ({ toast, onDismiss }: ToastProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setVisible(true));
    const id = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDismiss, 200);
    }, 5000);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(id);
    };
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`pointer-events-auto w-full max-w-md rounded-3xl border p-4 shadow-2xl transition-opacity duration-200 motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      } ${
        toast.tone === "success"
          ? "border-emerald-700/20 bg-emerald-950 text-white"
          : "border-red-700/20 bg-red-950 text-white"
      }`}
      role="status"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-black">{toast.title}</p>
          <p className="mt-1 text-sm leading-6 text-white/80">
            {toast.message}
          </p>
        </div>
        <button
          aria-label="Dismiss Notification"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 motion-reduce:transition-none"
          onClick={onDismiss}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
};
