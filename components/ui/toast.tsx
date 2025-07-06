'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

type ToastType = 'default' | 'destructive';

interface ToastProps {
  id: string;
  title?: string;
  description: string;
  type?: ToastType;
  onDismiss: (id: string) => void;
}

type ToastData = Omit<ToastProps, 'onDismiss'>;

export function Toast({ id, title, description, type = 'default', onDismiss }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const bgColor = type === 'destructive' ? 'bg-destructive' : 'bg-primary';
  const textColor = type === 'destructive' ? 'text-destructive-foreground' : 'text-primary-foreground';

  return (
    <div className={`${bgColor} ${textColor} rounded-lg shadow-lg p-4 mb-2 w-full max-w-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {title && <h3 className="font-medium">{title}</h3>}
          <p className="text-sm">{description}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={`${textColor} hover:bg-opacity-20 hover:bg-white`}
          onClick={() => onDismiss(id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface ToastContextType {
  showToast: (message: string, options?: { title?: string; type?: ToastType }) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const showToast = React.useCallback(
    (description: string, options: { title?: string; type?: ToastType } = {}) => {
      const id = Math.random().toString(36).substr(2, 9);
      const { title, type = 'default' } = options;
      setToasts((currentToasts) => [...currentToasts, { id, title, description, type } as ToastData]);
    },
    []
  );

  const dismissToast = React.useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
