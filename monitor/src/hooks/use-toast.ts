// Simple toast adapter that wraps sonner for compatibility
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    if (options.variant === "destructive") {
      return sonnerToast.error(options.title, {
        description: options.description,
      });
    }
    return sonnerToast.success(options.title, {
      description: options.description,
    });
  };

  toast.success = (message: string, options?: { description?: string }) => {
    return sonnerToast.success(message, options);
  };

  toast.error = (message: string, options?: { description?: string }) => {
    return sonnerToast.error(message, options);
  };

  toast.info = (message: string, options?: { description?: string }) => {
    return sonnerToast.info(message, options);
  };

  toast.warning = (message: string, options?: { description?: string }) => {
    return sonnerToast.warning(message, options);
  };

  return { toast };
}

// Direct toast export for non-hook usage
export const toast = {
  success: (message: string, options?: { description?: string }) => {
    return sonnerToast.success(message, options);
  },
  error: (message: string, options?: { description?: string }) => {
    return sonnerToast.error(message, options);
  },
  info: (message: string, options?: { description?: string }) => {
    return sonnerToast.info(message, options);
  },
  warning: (message: string, options?: { description?: string }) => {
    return sonnerToast.warning(message, options);
  },
};
