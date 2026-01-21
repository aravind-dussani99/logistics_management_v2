import React from 'react';

interface ConfirmDialogProps {
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => (
  <div className="space-y-6">
    <div className="text-sm text-gray-600 dark:text-gray-300">{message}</div>
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {cancelText}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
      >
        {confirmText}
      </button>
    </div>
  </div>
);

export default ConfirmDialog;
