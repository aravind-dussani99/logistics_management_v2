import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const Profile: React.FC = () => {
  const { currentUser, updateProfile } = useAuth();
  const user = currentUser as User | null;
  const [name, setName] = useState(user?.name || '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber || '');
  const [email, setEmail] = useState(user?.email || '');
  const [addressLine1, setAddressLine1] = useState(user?.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(user?.addressLine2 || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || '');
  const [postalCode, setPostalCode] = useState(user?.postalCode || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filters = useMemo(() => ({ dateFrom: '', dateTo: '' }), []);

  if (!user) {
    return null;
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile photo must be under 2 MB.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setError('Failed to read profile photo.');
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!mobileNumber.trim()) {
      setError('Mobile number is required.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile(user.id, {
        name,
        avatarUrl,
        mobileNumber,
        email,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
      });
      setSuccess('Profile updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Update your personal details and profile photo."
        filters={filters}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showAddAction={false}
      />
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <form className="space-y-6" onSubmit={handleSave}>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex flex-col items-center space-y-3">
              <img
                className="h-28 w-28 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                src={avatarUrl || 'https://i.pravatar.cc/150?u=default'}
                alt="Profile"
              />
              <label className="text-sm text-primary cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                Upload Photo
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div>
                <label htmlFor="profile-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Login Username
                </label>
                <input
                  id="profile-username"
                  name="profile-username"
                  type="text"
                  value={user.username || ''}
                  readOnly
                  className="mt-1 w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label htmlFor="profile-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Role
                </label>
                <input
                  id="profile-role"
                  name="profile-role"
                  type="text"
                  value={user.role}
                  readOnly
                  className="mt-1 w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </label>
                <input
                  id="profile-name"
                  name="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label htmlFor="profile-mobile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mobile Number *
                </label>
                <input
                  id="profile-mobile"
                  name="profile-mobile"
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email (optional)
                </label>
                <input
                  id="profile-email"
                  name="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="profile-address1" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Address Line 1
              </label>
              <input
                id="profile-address1"
                name="profile-address1"
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="profile-address2" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Address Line 2
              </label>
              <input
                id="profile-address2"
                name="profile-address2"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="profile-city" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                City
              </label>
              <input
                id="profile-city"
                name="profile-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="profile-state" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                State
              </label>
              <input
                id="profile-state"
                name="profile-state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="profile-postal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Postal Code
              </label>
              <input
                id="profile-postal"
                name="profile-postal"
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-500">{success}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
