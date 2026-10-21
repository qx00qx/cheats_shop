import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 3000) => {
    const id = Date.now().toString();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    // Автоматическое удаление
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

// Хук для удобного использования toasts
export const useToast = () => {
  const { addToast, removeToast, clearToasts } = useToastStore();

  const success = (message: string, duration?: number) => {
    addToast("success", message, duration);
  };

  const error = (message: string, duration?: number) => {
    addToast("error", message, duration);
  };

  const info = (message: string, duration?: number) => {
    addToast("info", message, duration);
  };

  const warning = (message: string, duration?: number) => {
    addToast("warning", message, duration);
  };

  return {
    success,
    error,
    info,
    warning,
    removeToast,
    clearToasts,
  };
};
