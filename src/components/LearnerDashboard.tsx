"use client";

import { useEffect, useState } from "react";
import {
  LearnerProfile,
  SentMessageDraft,
  LearnerPhraseProgress,
  loadSentDrafts,
  loadLearnerProgress,
} from "@/lib/helpers";

type Props = {
  learnerProfile: LearnerProfile;
  onNavigateToLibrary: () => void;
  onNavigateToReview: () => void;
};

export default function LearnerDashboard({
  learnerProfile,
  onNavigateToLibrary,
  onNavigateToReview,
}: Props) {
  const [sentDrafts, setSentDrafts] = useState<SentMessageDraft[]>([]);
  const [progress, setProgress] = useState<LearnerPhraseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [drafts, prog] = await Promise.all([
        loadSentDrafts(),
        loadLearnerProgress(learnerProfile.id),
      ]);

      if (!drafts) {
        setError("Failed to load phrases.");
      } else {
        setSentDrafts(drafts);
      }

      setProgress(prog);
      setLoading(false);
    }

    load();
  }, [learnerProfile.id]);

  const todaysDraft = sentDrafts[0] ?? null;

  const now = new Date();
  const dueCount = progress.filter(
    (p) =>
      ["new", "learning", "reviewing"].includes(p.status) &&
      p.next_review_at != null &&
      new Date(p.next_review_at) <= now
  ).length;

  const masteredCount = progress.filter((p) => p.status === "mastered").length;
  const totalTracked = progress.length;

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
      <p className="mt-1 text-slate-600">Here&apos;s your English phrase progress.</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Due for review</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{dueCount}</p>
          {dueCount > 0 && (
            <button
              onClick={onNavigateToReview}
              className="mt-3 text-sm font-medium text-blue-600 hover:underline"
            >
              Start review →
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Mastered</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{masteredCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Phrase bank</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{totalTracked}</p>
          <button
            onClick={onNavigateToLibrary}
            className="mt-3 text-sm font-medium text-blue-600 hover:underline"
          >
            View library →
          </button>
        </div>
      </div>

      {/* Today's phrase */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Today&apos;s phrase</h2>

        {todaysDraft ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xl font-semibold text-slate-900">{todaysDraft.phrase_text}</p>

            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {todaysDraft.phrase_category && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {todaysDraft.phrase_category}
                </span>
              )}
              {todaysDraft.phrase_level && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {todaysDraft.phrase_level}
                </span>
              )}
              {todaysDraft.phrase_rating != null && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {todaysDraft.phrase_rating}/10
                </span>
              )}
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {todaysDraft.message_text}
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-600">No phrases sent yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
