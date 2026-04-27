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
  unpauseLearnerPhrase,
} from "@/lib/helpers";

type FilterOption = "all" | ProgressStatus;

const FILTERS: FilterOption[] = ["all", "new", "learning", "reviewing", "mastered", "paused"];

type Props = {
  learnerProfile: LearnerProfile;
  onPracticePhrase: (phraseId: number) => void;
};

type DetailSectionKey =
  | "intro"
  | "phrase"
  | "meaning"
  | "italian"
  | "examples"
  | "dialogues"
  | "usage"
  | "pronunciation"
  | "notes"
  | "review";

type ParsedPhraseContent = {
  summary: string;
  sections: Partial<Record<DetailSectionKey, string[]>>;
};

const DETAIL_SECTION_ORDER: DetailSectionKey[] = [
  "phrase",
  "meaning",
  "italian",
  "examples",
  "dialogues",
  "usage",
  "pronunciation",
  "notes",
  "review",
  "intro",
];

const DETAIL_SECTION_LABELS: Record<DetailSectionKey, string> = {
  intro: "More context",
  phrase: "Phrase",
  meaning: "Meaning",
  italian: "Italian translation",
  examples: "Examples",
  dialogues: "Short dialogues",
  usage: "Usage notes",
  pronunciation: "Pronunciation notes",
  notes: "Notes",
  review: "Review info",
};

function normalizeSectionLabel(raw: string): DetailSectionKey {
  const label = raw.toLowerCase().trim();
  if (label === "phrase") return "phrase";
  if (label === "meaning") return "meaning";
  if (label === "italian") return "italian";
  if (label === "examples") return "examples";
  if (label === "short dialogues" || label === "dialogues" || label === "short dialogue") {
    return "dialogues";
  }
  if (label === "usage" || label === "usage note" || label === "usage notes") return "usage";
  if (
    label === "pronunciation" ||
    label === "pronunciation note" ||
    label === "pronunciation notes"
  ) {
    return "pronunciation";
  }
  if (label === "review" || label === "review info" || label === "review notes") return "review";
  return "notes";
}

function parsePhraseContent(message: string): ParsedPhraseContent {
  const sections: Partial<Record<DetailSectionKey, string[]>> = {};
  const lines = message.split("\n");
  let currentSection: DetailSectionKey = "intro";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headerMatch = line.match(
      /^(Phrase|Meaning|Italian|Examples|Short dialogues?|Dialogues|Usage(?: notes?)?|Pronunciation(?: notes?)?|Note|Notes|Review(?: info| notes)?)\s*:\s*(.*)$/i
    );

    if (headerMatch) {
      currentSection = normalizeSectionLabel(headerMatch[1]);
      const remainder = headerMatch[2]?.trim();
      if (remainder) {
        sections[currentSection] = [...(sections[currentSection] ?? []), remainder];
      } else if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed && !sections[currentSection]) continue;
    sections[currentSection] = [...(sections[currentSection] ?? []), line];
  }

  const meaningLine = (sections.meaning ?? []).find((line) => line.trim().length > 0)?.trim();
  const introLine = (sections.intro ?? []).find((line) => line.trim().length > 0)?.trim();
  const summary = meaningLine ?? introLine ?? "Open details for full learning content.";

  return { summary, sections };
}

function formatReviewDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDifficultyClass(difficulty: PracticeDifficulty): string {
  if (difficulty === "hard") return "bg-rose-50 text-rose-700 border border-rose-100";
  if (difficulty === "medium") return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-emerald-50 text-emerald-700 border border-emerald-100";
}

function getStatusClass(status: ProgressStatus): string {
  if (status === "learning") return "bg-blue-100 text-blue-700";
  if (status === "reviewing") return "bg-amber-100 text-amber-700";
  if (status === "mastered") return "bg-emerald-100 text-emerald-700";
  if (status === "paused") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function DetailContent({
  draft,
  progress,
}: {
  draft: SentMessageDraft;
  progress: LearnerPhraseProgress | undefined;
}) {
  const parsed = parsePhraseContent(draft.message_text);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-medium capitalize ${getStatusClass(progress?.status ?? "new")}`}>
          {progress?.status ?? "new"}
        </span>
        {progress?.current_difficulty && (
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-medium capitalize text-blue-700">
            Current {progress.current_difficulty}
          </span>
        )}
        {progress?.next_review_at && (
          <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            Due {formatReviewDate(progress.next_review_at)}
          </span>
        )}
        {typeof progress?.times_seen === "number" && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
            {progress.times_seen} reviews
          </span>
        )}
      </div>

      {DETAIL_SECTION_ORDER.map((section) => {
        const lines = parsed.sections[section] ?? [];
        const content = lines.join("\n").trim();
        if (!content) return null;

        return (
          <section key={section}>
            <h4 className="text-sm font-semibold text-slate-900">{DETAIL_SECTION_LABELS[section]}</h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{content}</p>
          </section>
        );
      })}
    </div>
  );
}

export default function LearnerLibrary({ learnerProfile, onPracticePhrase }: Props) {
  const [sentDrafts, setSentDrafts] = useState<SentMessageDraft[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, LearnerPhraseProgress>>({});
  const [difficultiesByPhrase, setDifficultiesByPhrase] = useState<Record<number, PracticeDifficulty[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedPhraseId, setSelectedPhraseId] = useState<number | null>(null);
  const [didAutoSelectInitial, setDidAutoSelectInitial] = useState(false);

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

  async function handleUnpause(phraseId: number) {
    setActionLoading(phraseId);
    const { error: err } = await unpauseLearnerPhrase(learnerProfile.id, phraseId);
    if (err) {
      setError(err);
    } else {
      setProgressMap((current) => {
        const existing = current[phraseId];
        if (existing) {
          return { ...current, [phraseId]: { ...existing, status: "learning" } };
        }
        const now = new Date().toISOString();
        return {
          ...current,
          [phraseId]: {
            id: 0,
            learner_id: learnerProfile.id,
            phrase_id: phraseId,
            status: "learning",
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

  useEffect(() => {
    if (selectedPhraseId == null) return;
    if (!filtered.some((draft) => draft.phrase_id === selectedPhraseId)) {
      setSelectedPhraseId(null);
    }
  }, [filtered, selectedPhraseId]);

  useEffect(() => {
    if (didAutoSelectInitial) return;
    if (filtered.length === 0 || selectedPhraseId != null) return;
    setSelectedPhraseId(filtered[0].phrase_id);
    setDidAutoSelectInitial(true);
  }, [didAutoSelectInitial, filtered, selectedPhraseId]);

  const selectedDraft =
    selectedPhraseId == null
      ? null
      : filtered.find((draft) => draft.phrase_id === selectedPhraseId) ?? null;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1240px] p-5 md:p-8">
        <p className="text-slate-600">Loading your phrase library…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] rounded-3xl bg-slate-50/70 p-5 md:p-8">
      <h1 className="text-3xl font-semibold text-slate-950">Phrase Library</h1>
      <p className="mt-1 text-slate-600">All phrases sent to you.</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-slate-600">No phrases in this category.</p>
            </div>
          ) : (
            filtered.map((draft) => {
              const status = getEffectiveStatus(draft.phrase_id);
              const isUpdating = actionLoading === draft.phrase_id;
              const parsed = parsePhraseContent(draft.message_text);
              const progress = progressMap[draft.phrase_id];
              const isSelected = selectedPhraseId === draft.phrase_id;

              return (
                <div
                  key={draft.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPhraseId(draft.phrase_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedPhraseId(draft.phrase_id);
                    }
                  }}
                  className={`relative rounded-2xl border bg-white p-3.5 shadow-sm transition-all hover:shadow-md ${
                    isSelected
                      ? "border-blue-300 bg-blue-50/40 ring-1 ring-blue-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {isSelected && <div className="absolute inset-y-3 left-0 w-1 rounded-r bg-slate-900" />}

                  <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-base font-semibold text-slate-900">{draft.phrase_text}</h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusClass(status)}`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {draft.phrase_category && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                            {draft.phrase_category}
                          </span>
                        )}
                        {draft.phrase_level && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                            {draft.phrase_level}
                          </span>
                        )}
                        {draft.phrase_rating != null && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                            {draft.phrase_rating}/10
                          </span>
                        )}

                        {(difficultiesByPhrase[draft.phrase_id] ?? []).length > 0 ? (
                          (difficultiesByPhrase[draft.phrase_id] ?? []).map((difficulty) => (
                            <span
                              key={difficulty}
                              className={`rounded-full px-2.5 py-1 capitalize ${getDifficultyClass(difficulty)}`}
                            >
                              {difficulty}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                            No approved exercises
                          </span>
                        )}

                        {progress?.current_difficulty && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 capitalize">
                            Current {progress.current_difficulty}
                          </span>
                        )}
                        {progress?.next_review_at && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                            Due {formatReviewDate(progress.next_review_at)}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 line-clamp-1 text-sm text-slate-700">{parsed.summary}</p>
                    </div>

                    <div className="flex w-full flex-row flex-wrap items-center justify-end gap-1.5 md:w-auto md:min-w-[168px] md:flex-col md:items-stretch">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onPracticePhrase(draft.phrase_id);
                        }}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Practise this
                      </button>
                      {status === "paused" ? (
                        <button
                          disabled={isUpdating}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleUnpause(draft.phrase_id);
                          }}
                          className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-200 disabled:opacity-40"
                        >
                          Unpause
                        </button>
                      ) : (
                        <button
                          disabled={isUpdating}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSetStatus(draft.phrase_id, "paused");
                          }}
                          className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-40"
                        >
                          Pause
                        </button>
                      )}
                      <div className="inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-500">
                        <span>{isSelected ? "Selected" : "Open details"}</span>
                        <svg
                          viewBox="0 0 20 20"
                          className={`h-4 w-4 transition-transform ${isSelected ? "rotate-180 text-slate-800" : ""}`}
                          fill="none"
                          aria-hidden="true"
                        >
                          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 border-t border-slate-200 pt-3 lg:hidden">
                      <DetailContent draft={draft} progress={progress} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 min-h-[72vh] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {selectedDraft ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Phrase details</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                      {selectedDraft.phrase_text}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedPhraseId(null)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onPracticePhrase(selectedDraft.phrase_id)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Practise this
                  </button>
                  {getEffectiveStatus(selectedDraft.phrase_id) === "paused" ? (
                    <button
                      disabled={actionLoading === selectedDraft.phrase_id}
                      onClick={() => handleUnpause(selectedDraft.phrase_id)}
                      className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-200 disabled:opacity-40"
                    >
                      Unpause
                    </button>
                  ) : (
                    <button
                      disabled={actionLoading === selectedDraft.phrase_id}
                      onClick={() => handleSetStatus(selectedDraft.phrase_id, "paused")}
                      className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-40"
                    >
                      Pause
                    </button>
                  )}
                </div>
                <div className="mt-5 max-h-[68vh] overflow-y-auto pr-1">
                  <DetailContent
                    draft={selectedDraft}
                    progress={progressMap[selectedDraft.phrase_id]}
                  />
                </div>
              </>
            ) : (
              <div className="flex min-h-[60vh] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-600">Select a phrase to view full details.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
