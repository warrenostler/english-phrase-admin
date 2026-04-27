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
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-slate-600">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-50/70 px-4 py-5 sm:px-6 md:py-6 lg:px-8 xl:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Welcome back{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="mt-1.5 text-base text-slate-600">Ready for your next practice session?</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-7 grid grid-cols-1 gap-6 lg:[grid-template-columns:repeat(2,minmax(260px,1fr))]">
          <div className="flex h-full flex-col justify-between rounded-2xl border border-blue-300/80 bg-blue-50 p-6 shadow-md">
            <p className="text-sm font-semibold text-slate-600">Phrases ready to practise</p>
            <p className="mt-3 text-5xl font-bold leading-none text-slate-900">{summary.readyToPractice}</p>
            <button
              onClick={onStartStudy}
              className="mt-6 w-fit rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Start study session
            </button>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-indigo-300/70 bg-indigo-50/70 p-6 shadow-md">
            <p className="text-sm font-semibold text-slate-600">New phrases available</p>
            <p className="mt-3 text-4xl font-bold leading-none text-slate-900">{summary.newAvailable}</p>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-amber-300/75 bg-amber-50/70 p-6 shadow-md">
            <p className="text-sm font-semibold text-slate-600">Ready for review</p>
            <p className="mt-3 text-4xl font-bold leading-none text-slate-900">{summary.reviewDue}</p>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-emerald-300/75 bg-emerald-50/70 p-6 shadow-md">
            <p className="text-sm font-semibold text-slate-600">Mastered phrases</p>
            <p className="mt-3 text-4xl font-bold leading-none text-slate-900">{summary.mastered}</p>
            <button
              onClick={onNavigateToLibrary}
              className="mt-auto pt-6 text-left text-sm font-semibold text-emerald-700 hover:underline"
            >
              View library →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
