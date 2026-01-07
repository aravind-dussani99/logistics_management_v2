import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/authApi';
import Modal from '../components/Modal';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const { login } = useAuth();

  const isAdminUsername = useMemo(
    () => username.trim().toLowerCase() === 'admin',
    [username]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password.');
    }
    setIsSubmitting(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (!resetPassword || resetPassword !== resetConfirm) {
      setResetError('Passwords do not match.');
      return;
    }
    setIsResetting(true);
    try {
      await authApi.resetAdminPassword('admin', resetPassword, resetToken);
      setResetSuccess('Admin password updated. You can sign in now.');
      setResetPassword('');
      setResetConfirm('');
      setResetToken('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password.';
      setResetError(message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-light dark:bg-dark">
      <div className="w-full max-w-sm p-8 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center">
            <div className="flex items-center justify-center mb-4">
                <ion-icon name="server-outline" className="text-5xl text-primary"></ion-icon>
                <span className="text-gray-800 dark:text-white text-4xl mx-2 font-semibold">LogiTrack</span>
            </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-white">Sign in to your account</h2>
        </div>
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <div className="mt-1">
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
        {isAdminUsername && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-sm text-primary hover:text-primary-dark"
            >
              Reset admin password
            </button>
          </div>
        )}
      </div>
      <Modal
        isOpen={showReset}
        onClose={() => {
          setShowReset(false);
          setResetError('');
          setResetSuccess('');
        }}
        title="Reset Admin Password"
      >
        <form className="p-6 space-y-4" onSubmit={handleReset}>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter the admin reset token and a new password for the admin account.
          </p>
          <div>
            <label htmlFor="resetToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reset Token
            </label>
            <input
              id="resetToken"
              name="resetToken"
              type="password"
              required
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="resetPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <input
              id="resetPassword"
              name="resetPassword"
              type="password"
              required
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="resetConfirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm Password
            </label>
            <input
              id="resetConfirm"
              name="resetConfirm"
              type="password"
              required
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
          {resetError && <p className="text-sm text-red-500">{resetError}</p>}
          {resetSuccess && <p className="text-sm text-green-500">{resetSuccess}</p>}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowReset(false)}
              className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResetting}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none disabled:opacity-50"
            >
              {isResetting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Login;
