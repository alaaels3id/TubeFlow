import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useI18n } from '../../hooks/useI18n';

export const ConfirmModal: React.FC = () => {
  const { confirmModal, closeConfirmModal } = useAppStore();
  const { t } = useI18n();

  if (!confirmModal || !confirmModal.isOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeConfirmModal}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={22} color="var(--color-primary-500)" />
            <h3 className="modal-title">{confirmModal.title}</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={closeConfirmModal}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p>{confirmModal.message}</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeConfirmModal}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              confirmModal.onConfirm();
              closeConfirmModal();
            }}
          >
            {confirmModal.confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
