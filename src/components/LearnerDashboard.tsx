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
  const firstName = learnerProfile.first_name?.trim().split(/\s+/)[0] ?? "";

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
      <div className="w-full bg-slate-50/70 px-4 py-5 sm:px-6 md:py-6 lg:px-8 xl:px-10">
        <p className="text-slate-600">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-50/70 px-4 py-5 sm:px-6 md:py-6 lg:px-8 xl:px-10">
      <h1 className="text-3xl font-semibold text-slate-900">
        Welcome back{firstName ? `, ${firstName}` : ""}!
      </h1>
      <p className="mt-1 text-slate-600">Ready for your next practice session?</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:[grid-template-columns:repeat(2,minmax(260px,1fr))]">
        <div className="flex h-full flex-col justify-between rounded-2xl border border-blue-200/70 bg-blue-50/70 p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Phrases ready to practise</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">{summary.readyToPractice}</p>
          <button
            onClick={onStartStudy}
            className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Start study session
          </button>
        </div>

        <div className="flex h-full flex-col rounded-2xl border border-indigo-200/70 bg-indigo-50/60 p-6 shadow-sm">
          <p className="text-sm text-slate-500">New phrases available</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.newAvailable}</p>
        </div>

        <div className="flex h-full flex-col rounded-2xl border border-amber-200/70 bg-amber-50/60 p-6 shadow-sm">
          <p className="text-sm text-slate-500">Ready for review</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.reviewDue}</p>
        </div>

        <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-6 shadow-sm">
          <p className="text-sm text-slate-500">Mastered phrases</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.mastered}</p>
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
