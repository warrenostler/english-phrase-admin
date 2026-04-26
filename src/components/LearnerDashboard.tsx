"use client";

import { useEffect, useState } from "react";
import {
  LearnerProfile,
  StudySummary,
  loadLearnerStudySummary,
} from "@/lib/helpers";

type Props = {
  learnerProfile: LearnerProfile;
  onStartStudy: () => void;
  onNavigateToLibrary: () => void;
};

export default function LearnerDashboard({
  learnerProfile,
  onStartStudy,
  onNavigateToLibrary,
}: Props) {
  const [summary, setSummary] = useState<StudySummary>({
    readyToPractice: 0,
    newAvailable: 0,
    reviewDue: 0,
    mastered: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const data = await loadLearnerStudySummary(learnerProfile.id);

      if (!isMounted) return;
      setSummary(data);
      setLoading(false);
    }

    load().catch((e: unknown) => {
      if (!isMounted) return;
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [learnerProfile.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <p className="text-slate-600">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-semibold text-slate-900">
        Welcome back{learnerProfile.first_name ? `, ${learnerProfile.first_name}` : ""}!
      </h1>
      <p className="mt-1 text-slate-600">Ready for your next practice session?</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Phrases ready to practise</p>
        <p className="mt-1 text-4xl font-bold text-slate-900">{summary.readyToPractice}</p>
        <button
          onClick={onStartStudy}
          className="mt-4 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Start study session
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">New phrases available</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{summary.newAvailable}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Review phrases due</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{summary.reviewDue}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Mastered phrases</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{summary.mastered}</p>
          <button
            onClick={onNavigateToLibrary}
            className="mt-3 text-sm font-medium text-blue-600 hover:underline"
          >
            View library →
          </button>
        </div>
      </div>
    </div>
  );
}
