"use client";

import { useEffect, useState } from "react";
import {
  LearnerProfile,
  SentMessageDraft,
  LearnerPhraseProgress,
  ReviewResult,
  loadSentDrafts,
  loadLearnerProgress,
  submitReviewResult,
} from "@/lib/helpers";

type DueItem = {
  draft: SentMessageDraft;
  progress: LearnerPhraseProgress;
};

type Props = {
  learnerProfile: LearnerProfile;
};

const RESULT_BUTTONS: { label: string; value: ReviewResult; className: string }[] = [
  { label: "Again", value: "again", className: "bg-red-600 hover:bg-red-700 text-white" },
  { label: "Hard", value: "hard", className: "bg-orange-500 hover:bg-orange-600 text-white" },
  { label: "Good", value: "good", className: "bg-blue-600 hover:bg-blue-700 text-white" },
  { label: "Easy", value: "easy", className: "bg-green-700 hover:bg-green-800 text-white" },
];

export default function LearnerReview({ learnerProfile }: Props) {
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerProfile.id]);

  async function load() {
    setLoading(true);
    setError(null);
    setDone(false);
    setCurrentIndex(0);

    const [drafts, prog] = await Promise.all([
      loadSentDrafts(),
      loadLearnerProgress(learnerProfile.id),
    ]);

    const now = new Date();
    const progressMap: Record<number, LearnerPhraseProgress> = Object.fromEntries(
      prog.map((p) => [p.phrase_id, p])
    );

    const due: DueItem[] = [];

    for (const draft of drafts) {
      const p = progressMap[draft.phrase_id];
      if (!p) continue;
      if (!["new", "learning", "reviewing"].includes(p.status)) continue;
      if (!p.next_review_at) continue;
      if (new Date(p.next_review_at) > now) continue;
      due.push({ draft, progress: p });
    }

    setDueItems(due);
    setLoading(false);
    if (due.length === 0) setDone(true);
  }

  async function handleResult(result: ReviewResult) {
    const item = dueItems[currentIndex];
    if (!item) return;

    setSubmitting(true);
    setError(null);

    const { error: err } = await submitReviewResult(
      learnerProfile.id,
      item.draft.phrase_id,
      item.draft.id,
      item.progress.id,
      item.progress.times_seen,
      item.progress.times_correct,
      result
    );

    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= dueItems.length) {
      setDone(true);
    } else {
      setCurrentIndex(nextIndex);
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-10">
        <p className="text-slate-600">Loading review queue…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-2xl font-semibold text-slate-900">All caught up! 🎉</p>
          <p className="mt-2 text-slate-600">No phrases due for review right now.</p>
          <button
            onClick={load}
            className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const current = dueItems[currentIndex];
  const remaining = dueItems.length - currentIndex;

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">Review</h1>
        <span className="text-sm text-slate-500">{remaining} remaining</span>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-2xl font-semibold text-slate-900">{current.draft.phrase_text}</p>

        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {current.draft.phrase_category && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              {current.draft.phrase_category}
            </span>
          )}
          {current.draft.phrase_level && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              {current.draft.phrase_level}
            </span>
          )}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {current.draft.message_text}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {RESULT_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              disabled={submitting}
              onClick={() => handleResult(btn.value)}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${btn.className}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
