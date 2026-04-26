"use client";

import { useEffect, useState } from "react";
import {
  LearnerProfile,
  SentMessageDraft,
  LearnerPhraseProgress,
  ProgressStatus,
  PracticeDifficulty,
  loadApprovedPracticeItems,
  loadLearnerPracticeProgress,
  loadSentDrafts,
  loadLearnerProgress,
  upsertLearnerProgress,
} from "@/lib/helpers";

type FilterOption = "all" | ProgressStatus;

const FILTERS: FilterOption[] = ["all", "new", "learning", "reviewing", "mastered", "paused"];

type Props = {
  learnerProfile: LearnerProfile;
  onPracticePhrase: (phraseId: number) => void;
};

export default function LearnerLibrary({ learnerProfile, onPracticePhrase }: Props) {
  const [sentDrafts, setSentDrafts] = useState<SentMessageDraft[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, LearnerPhraseProgress>>({});
  const [difficultiesByPhrase, setDifficultiesByPhrase] = useState<Record<number, PracticeDifficulty[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  async function load() {
    const [drafts, prog, items, practiceProgress] = await Promise.all([
      loadSentDrafts(),
      loadLearnerProgress(learnerProfile.id),
      loadApprovedPracticeItems(),
      loadLearnerPracticeProgress(learnerProfile.id),
    ]);

    setSentDrafts(drafts);
    setProgressMap(Object.fromEntries(prog.map((p) => [p.phrase_id, p])));

    const grouped: Record<number, PracticeDifficulty[]> = {};
    for (const item of items) {
      const list = grouped[item.phrase_id] ?? [];
      if (!list.includes(item.difficulty)) {
        list.push(item.difficulty);
      }
      grouped[item.phrase_id] = list;
    }
    setDifficultiesByPhrase(grouped);

    const pausedByPractice = new Set(
      practiceProgress
        .filter((p) => p.status === "paused")
        .map((p) => p.practice_item_id)
    );

    if (pausedByPractice.size > 0) {
      // If any approved practice item for a phrase is paused, reflect paused status for browsing.
      setProgressMap((current) => {
        const next = { ...current };
        for (const item of items) {
          if (!pausedByPractice.has(item.id)) continue;
          const existing = next[item.phrase_id];
          if (existing) {
            next[item.phrase_id] = { ...existing, status: "paused" };
          }
        }
        return next;
      });
    }

    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerProfile.id]);

  async function handleSetStatus(phraseId: number, status: ProgressStatus) {
    setActionLoading(phraseId);
    const { error: err } = await upsertLearnerProgress(learnerProfile.id, phraseId, status);
    if (err) {
      setError(err);
    } else {
      // Optimistically update local state
      setProgressMap((current) => {
        const existing = current[phraseId];
        if (existing) {
          return { ...current, [phraseId]: { ...existing, status } };
        }
        const now = new Date().toISOString();
        return {
          ...current,
          [phraseId]: {
            id: 0,
            learner_id: learnerProfile.id,
            phrase_id: phraseId,
            status,
            current_difficulty: null,
            mastery_interval_days: 3,
            mastered_at: null,
            last_mastery_review_at: null,
            ease_score: null,
            next_review_at: now,
            last_reviewed_at: null,
            times_seen: 0,
            times_correct: 0,
            created_at: now,
            updated_at: now,
          },
        };
      });
    }
    setActionLoading(null);
  }

  const getEffectiveStatus = (phraseId: number): ProgressStatus =>
    progressMap[phraseId]?.status ?? "new";

  const filtered = sentDrafts.filter((d) => {
    if (filter === "all") return true;
    return getEffectiveStatus(d.phrase_id) === filter;
  });

  const statusBadgeClass: Record<ProgressStatus, string> = {
    new: "bg-slate-100 text-slate-600",
    learning: "bg-blue-100 text-blue-700",
    reviewing: "bg-yellow-100 text-yellow-700",
    mastered: "bg-green-100 text-green-700",
    paused: "bg-orange-100 text-orange-700",
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 md:p-10">
        <p className="text-slate-600">Loading your phrase library…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="text-3xl font-semibold text-slate-900">Phrase Library</h1>
      <p className="mt-1 text-slate-600">All phrases sent to you.</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-600">No phrases in this category.</p>
          </div>
        ) : (
          filtered.map((draft) => {
            const status = getEffectiveStatus(draft.phrase_id);
            const isUpdating = actionLoading === draft.phrase_id;

            return (
              <div
                key={draft.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {draft.phrase_text}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass[status]}`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-2 text-sm">
                      {draft.phrase_category && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          {draft.phrase_category}
                        </span>
                      )}
                      {draft.phrase_level && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          {draft.phrase_level}
                        </span>
                      )}
                      {draft.phrase_rating != null && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          {draft.phrase_rating}/10
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {(difficultiesByPhrase[draft.phrase_id] ?? []).length > 0 ? (
                        (difficultiesByPhrase[draft.phrase_id] ?? []).map((difficulty) => (
                          <span
                            key={difficulty}
                            className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 capitalize"
                          >
                            {difficulty}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                          No approved exercises
                        </span>
                      )}

                      {progressMap[draft.phrase_id]?.current_difficulty && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700 capitalize">
                          Current: {progressMap[draft.phrase_id].current_difficulty}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {draft.message_text}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <button
                      onClick={() => onPracticePhrase(draft.phrase_id)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                    >
                      Practise this
                    </button>
                    <button
                      disabled={isUpdating || status === "paused"}
                      onClick={() => handleSetStatus(draft.phrase_id, "paused")}
                      className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-40"
                    >
                      Pause
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
