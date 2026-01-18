import React, { useMemo, useState } from 'react';

interface MergeOption {
  id: string;
  name: string;
}

interface MergeDialogProps {
  sourceLabel: string;
  sourceName: string;
  options: MergeOption[];
  onConfirm: (targetId: string) => void;
  onClose: () => void;
}

const MergeDialog: React.FC<MergeDialogProps> = ({
  sourceLabel,
  sourceName,
  options,
  onConfirm,
  onClose,
}) => {
  const [targetId, setTargetId] = useState('');
  const sortedOptions = useMemo(
    () => options.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [options]
  );
  const targetName = sortedOptions.find(option => option.id === targetId)?.name || '';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetId) return;
    onConfirm(targetId);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="space-y-2">
        <div className="text-sm text-gray-700 dark:text-gray-200">
          Merge <span className="font-semibold">{sourceLabel}</span> <span className="font-semibold">"{sourceName}"</span> into:
        </div>
        <select
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
          required
        >
          <option value="">Select target</option>
          {sortedOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        This will move all references to {targetName || 'the selected record'} and delete "{sourceName}".
      </div>

      <div className="pt-4 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!targetId}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none disabled:opacity-60"
        >
          Merge
        </button>
      </div>
    </form>
  );
};

export default MergeDialog;
