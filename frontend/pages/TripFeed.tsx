import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { TripActivity } from '../types';
import { tripApi } from '../services/tripApi';
import { formatDateDisplay } from '../utils';

const TripFeed: React.FC = () => {
  const { trips, loadTrips } = useData();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [posts, setPosts] = useState<TripActivity[]>([]);
  const [message, setMessage] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const fetchPosts = async (tripId: number) => {
    setLoadingPosts(true);
    try {
      const entries = await tripApi.getActivity(tripId);
      setPosts(entries);
    } catch (error) {
      console.error('Failed to load trip feed', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (!selectedTripId) {
      setPosts([]);
      return;
    }
    fetchPosts(selectedTripId);
  }, [selectedTripId]);

  const filteredTrips = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return trips.slice(0, 8);
    }
    return trips.filter(trip =>
      trip.customer?.toLowerCase().includes(term)
      || trip.invoiceDCNumber?.toLowerCase().includes(term)
      || String(trip.id).includes(term)
    ).slice(0, 8);
  }, [searchTerm, trips]);

  const selectedTrip = trips.find(trip => trip.id === selectedTripId);

  const handlePost = async () => {
    if (!selectedTripId || !message.trim()) return;
    setSubmitting(true);
    try {
      await tripApi.createActivity(selectedTripId, { message: message.trim(), action: 'post' });
      setMessage('');
      await fetchPosts(selectedTripId);
    } catch (error) {
      console.error('Failed to post to trip feed', error);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, []);

  const handleSelectTrip = (tripId: number) => {
    setSelectedTripId(tripId);
    setShowSuggestions(false);
    const trip = trips.find(t => t.id === tripId);
    setSearchTerm(trip ? `#${trip.id} · ${trip.customer}` : '');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdfbfb] via-[#ebedee] to-[#d0e2f2]">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-2xl font-bold">
            <span className="text-primary">LogiTrack Feed</span>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Collaboration</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
            <Link to="/trip-feed" className="text-primary font-semibold">Feed</Link>
            <span>Stories & Updates</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 shadow-sm scroll-smooth">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...Array(8)].map((_, index) => (
              <div key={`story-${index}`} className="flex flex-col items-center gap-2 text-xs">
                <div className="h-16 w-16 rounded-full border-2 border-gradient-to-br from-pink-500 via-yellow-400 to-purple-600 bg-gradient-to-br p-0.5 shadow-sm">
                  <div className="h-full w-full rounded-full bg-white p-1">
                    <div className="h-full w-full rounded-full bg-gray-200" />
                  </div>
                </div>
                <span className="text-gray-500">Story {index + 1}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-lg">
            <div className="mb-4 text-sm font-semibold text-gray-600">Start a trip conversation</div>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search trip by invoice, customer, or ID"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {showSuggestions && filteredTrips.length > 0 && (
                <div ref={suggestionRef} className="absolute z-10 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-xl">
                  {filteredTrips.map(trip => (
                    <button
                      key={`suggestion-${trip.id}`}
                      type="button"
                      onClick={() => handleSelectTrip(trip.id)}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      #{trip.id} · {trip.customer || 'Unknown'} · {formatDateDisplay(trip.date)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder={selectedTrip ? 'Share an update about the selected trip …' : 'Select a trip to start posting…'}
              className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <div className="mt-4 flex justify-between text-xs text-gray-500">
              <span>Connected to: {selectedTrip ? `#${selectedTrip.id}` : 'None yet'}</span>
              <button
                type="button"
                onClick={handlePost}
                disabled={!selectedTripId || !message.trim() || submitting}
                className="rounded-2xl bg-primary px-4 py-2 font-semibold text-white transition hover:bg-primary-dark disabled:bg-gray-400"
              >
                {submitting ? 'Posting…' : 'Post Update'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {loadingPosts && (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white/80 p-6 text-sm text-gray-500">
                Loading conversation…
              </div>
            )}
            {!loadingPosts && !selectedTripId && (
              <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 text-sm text-gray-500">
                Select a trip to view and post updates in this Instagram-style feed.
              </div>
            )}
            {!loadingPosts && selectedTripId && posts.map(post => (
              <article key={post.id} className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-lg">
                <header className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gray-200" />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{post.actorName}</div>
                      <div className="text-xs uppercase tracking-widest text-gray-500">{post.actorRole}</div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{formatDateDisplay(post.createdAt)}</span>
                </header>
                <p className="mb-4 text-sm text-gray-700">{post.message}</p>
                {post.attachments && post.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {post.attachments.map(file => (
                      <a
                        key={file.url}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-gray-200 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
                      >
                        {file.name || 'Attachment'}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default TripFeed;
