import React from 'react';

interface AlertDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="p-8 space-y-6">
      <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{message}</p>
      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

export default AlertDialog;
