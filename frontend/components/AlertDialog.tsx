import React from 'react';

interface AlertDialogProps {
  message: React.ReactNode;
  confirmText?: string;
  onConfirm: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  message,
  confirmText = 'OK',
  onConfirm,
}) => (
  <div className="space-y-6">
    <div className="text-sm text-gray-600 dark:text-gray-300">{message}</div>
    <div className="flex justify-end">
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

export default AlertDialog;
