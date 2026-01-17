import React, { useEffect, useState } from 'react';
import { Notification, Trip, TripActivity, TripUploadFile } from '../types';
import { tripApi } from '../services/tripApi';
import { useAuth } from '../contexts/AuthContext';

interface TripHistoryDialogProps {
  trip: Trip;
  notification?: Notification | null;
  onClose: () => void;
}

const TripHistoryDialog: React.FC<TripHistoryDialogProps> = ({ trip, notification, onClose }) => {
  const { currentUser } = useAuth();
  const [activity, setActivity] = useState<TripActivity[]>([]);
  const [error, setError] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [attachments, setAttachments] = useState<TripUploadFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canReply = Boolean(notification?.requesterRole || notification?.requesterName);

  useEffect(() => {
    if (!trip?.id) return;
    setIsLoading(true);
    tripApi.getActivity(trip.id)
      .then(setActivity)
      .catch((err) => {
        console.error('Failed to load trip activity', err);
        setError('Failed to load trip history.');
      })
      .finally(() => setIsLoading(false));
  }, [trip?.id]);

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try {
      const prepared = await Promise.all(files.map(file => new Promise<TripUploadFile>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, url: String(reader.result || '') });
        reader.onerror = () => reject(new Error('Failed to read attachment'));
        reader.readAsDataURL(file);
      })));
      setAttachments(prev => [...prev, ...prepared]);
    } catch (err) {
      console.error('Failed to read attachment', err);
      setError('Failed to read attachment.');
    } finally {
      event.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSendReply = async () => {
    if (!trip?.id || (!replyMessage.trim() && attachments.length === 0)) return;
    if (!currentUser) return;
    setIsSubmitting(true);
    setError('');
    try {
      const entry = await tripApi.createActivity(trip.id, {
        message: replyMessage.trim(),
        attachments,
        notifyRole: notification?.requesterRole || null,
        notifyUser: notification?.requesterName || null,
      });
      setActivity(prev => [entry, ...prev]);
      setReplyMessage('');
      setAttachments([]);
    } catch (err) {
      console.error('Failed to send reply', err);
      setError('Failed to send reply.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">
            {notification.requesterName || 'Request'}
            {notification.requesterContact ? ` - ${notification.requesterContact}` : ''}
          </div>
          <div className="mt-1">{notification.message}</div>
          {notification.requestMessage && (
            <div className="mt-2 text-xs text-amber-800">Remarks: {notification.requestMessage}</div>
          )}
        </div>
      )}

      {error && <div className="text-sm text-red-500">{error}</div>}
      {isLoading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading history...</div>
      ) : (
        <div className="space-y-4">
          {activity.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No activity logged yet.</div>
          )}
          {activity.length > 0 && (
            <ul className="space-y-3 text-sm">
              {activity.map(entry => (
                <li key={entry.id} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-none last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-800 dark:text-gray-100 capitalize">{entry.action.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-gray-600 dark:text-gray-300">{entry.message || '-'}</div>
                  {entry.attachments && entry.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.attachments.map((file, index) => (
                        <a
                          key={`${entry.id}-attachment-${index}`}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {file.name}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.actorName} ({entry.actorRole})
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canReply && (
        <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Respond to request</div>
          <textarea
            rows={3}
            value={replyMessage}
            onChange={(event) => setReplyMessage(event.target.value)}
            placeholder="Add your response..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">Attach images or PDFs</label>
            <input type="file" multiple onChange={handleAttachmentChange} className="text-sm text-gray-600 dark:text-gray-300" />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <button
                    key={`${file.name}-${index}`}
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {file.name} x
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={isSubmitting || (!replyMessage.trim() && attachments.length === 0)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripHistoryDialog;
