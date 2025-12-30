import React, { useState } from 'react';

interface ConfirmDeleteDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}) => {
  const [confirmation, setConfirmation] = useState('');
  const canConfirm = confirmation.trim().toUpperCase() === 'DELETE';

  return (
    <div className="p-8 space-y-6">
      <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{message}</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type DELETE to confirm</label>
        <input
          type="text"
          value={confirmation}
          onChange={e => setConfirmation(e.target.value)}
          className="mt-2 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="DELETE"
        />
      </div>
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

export default ConfirmDeleteDialog;
