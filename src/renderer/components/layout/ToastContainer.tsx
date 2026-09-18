import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        let Icon = Info;
        let iconColor = 'var(--status-info)';

        if (toast.type === 'success') {
          Icon = CheckCircle2;
          iconColor = 'var(--status-success)';
        } else if (toast.type === 'error') {
          Icon = AlertCircle;
          iconColor = 'var(--status-error)';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          iconColor = 'var(--status-warning)';
        }

        return (
          <div key={toast.id} className="toast">
            <Icon size={18} color={iconColor} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 2, height: 20, width: 20 }}
              onClick={() => removeToast(toast.id)}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
