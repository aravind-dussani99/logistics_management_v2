import React, { useState } from 'react';

interface RequestDialogProps {
  title: string;
  label?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (message: string) => void;
}

const RequestDialog: React.FC<RequestDialogProps> = ({
  title,
  label = 'Reason',
  confirmLabel = 'Submit Request',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}) => {
  const [message, setMessage] = useState('');

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <textarea
          value={message}
          onChange={event => setMessage(event.target.value)}
          rows={4}
          className="mt-2 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Enter a short reason to help admin review."
        />
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(message.trim())}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

export default RequestDialog;
