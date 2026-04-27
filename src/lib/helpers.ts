import { supabase } from "@/lib/supabaseClient";

export type UserRole = "admin" | "learner" | "none";

export type LearnerProfile = {
  id: string;
  email: string;
  first_name: string | null;
  native_language: string | null;
  target_language: string | null;
  level: string | null;
};

export type SentMessageDraft = {
  id: number;
  phrase_id: number;
  phrase_text: string;
  phrase_category: string | null;
  phrase_level: string | null;
  phrase_rating: number | null;
  message_text: string;
  created_at: string;
};

export type ProgressStatus = "new" | "learning" | "reviewing" | "mastered" | "paused";

export type LearnerPhraseProgress = {
  id: number;
  learner_id: string;
  phrase_id: number;
  status: ProgressStatus;
  current_difficulty: "easy" | "medium" | "hard" | null;
  mastery_interval_days: number | null;
  mastered_at: string | null;
  last_mastery_review_at: string | null;
  ease_score: number | null;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  times_seen: number;
  times_correct: number;
  created_at: string;
  updated_at: string;
};

export type ReviewResult = "again" | "hard" | "good" | "easy";
export type PracticeDifficulty = "easy" | "medium" | "hard";

export type PracticeItem = {
  id: number;
  phrase_id: number;
  message_draft_id: number | null;
  exercise_type: string;
  difficulty: PracticeDifficulty;
  italian_translation: string | null;
  prompt: string;
  correct_answer: string;
  acceptable_answers: unknown;
  hint: string | null;
  explanation: string | null;
  status: string;
  created_at: string;
  phrase_text: string;
  phrase_category: string | null;
  phrase_level: string | null;
  message_text: string | null;
};

export type LearnerPracticeItemProgress = {
  id: number;
  learner_id: string;
  practice_item_id: number;
  status: ProgressStatus;
  times_seen: number;
  times_correct: number;
  consecutive_correct: number;
  last_result: ReviewResult | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StudySessionItem = {
  practiceItem: PracticeItem;
  practiceProgress: LearnerPracticeItemProgress | null;
  phraseProgress: LearnerPhraseProgress | null;
};

export type StudySummary = {
  readyToPractice: number;
  newAvailable: number;
  reviewDue: number;
  mastered: number;
};

function toDifficulty(value: string | null | undefined): PracticeDifficulty {
  if (value === "medium" || value === "hard") return value;
  return "easy";
}

export async function loadUserRole(email: string, userId: string): Promise<UserRole> {
  const [adminByIdResult, adminByEmailResult, learnerResult] = await Promise.all([
    supabase.from("admin_users").select("id").eq("id", userId).maybeSingle(),
    supabase.from("admin_users").select("id").eq("email", email).maybeSingle(),
    supabase.from("learner_profiles").select("id").eq("id", userId).maybeSingle(),
  ]);

  const isAdmin = !!(adminByIdResult.data || adminByEmailResult.data);
  const isLearner = !!learnerResult.data;

  if (isAdmin) return "admin";
  if (isLearner) return "learner";
  return "none";
}

export async function loadLearnerProfile(userId: string): Promise<LearnerProfile | null> {
  const { data, error } = await supabase
    .from("learner_profiles")
    .select("id, email, first_name, native_language, target_language, level")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as LearnerProfile;
}

export async function loadSentDrafts(): Promise<SentMessageDraft[]> {
  const { data: drafts, error: draftsError } = await supabase
    .from("message_drafts")
    .select("id, phrase_id, message_text, created_at")
    .eq("status", "sent")
    .order("created_at", { ascending: false });

  if (draftsError || !drafts || drafts.length === 0) return [];

  const phraseIds = Array.from(new Set(drafts.map((d) => d.phrase_id)));

  const { data: phraseRows } = await supabase
    .from("phrases")
    .select("id, phrase, category, level, rating")
    .in("id", phraseIds);

  const phraseMap: Record<
    number,
    { phrase: string; category: string | null; level: string | null; rating: number | null }
  > = Object.fromEntries(
    (phraseRows ?? []).map((p) => [
      p.id,
      { phrase: p.phrase, category: p.category, level: p.level, rating: p.rating },
    ])
  );

  return drafts.map((d) => ({
    id: d.id,
    phrase_id: d.phrase_id,
    phrase_text: phraseMap[d.phrase_id]?.phrase ?? "Unknown phrase",
    phrase_category: phraseMap[d.phrase_id]?.category ?? null,
    phrase_level: phraseMap[d.phrase_id]?.level ?? null,
    phrase_rating: phraseMap[d.phrase_id]?.rating ?? null,
    message_text: d.message_text,
    created_at: d.created_at,
  }));
}

export async function loadLearnerProgress(learnerId: string): Promise<LearnerPhraseProgress[]> {
  const { data, error } = await supabase
    .from("learner_phrase_progress")
    .select("*")
    .eq("learner_id", learnerId);

  if (error || !data) return [];
  return data as LearnerPhraseProgress[];
}

export async function upsertLearnerProgress(
  learnerId: string,
  phraseId: number,
  status: ProgressStatus
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("learner_phrase_progress")
    .select("id, times_seen, times_correct, next_review_at, last_reviewed_at, created_at")
    .eq("learner_id", learnerId)
    .eq("phrase_id", phraseId)
    .maybeSingle();

  const payload = {
    learner_id: learnerId,
    phrase_id: phraseId,
    status,
    next_review_at: existing?.next_review_at ?? now,
    last_reviewed_at: existing?.last_reviewed_at ?? null,
    times_seen: existing?.times_seen ?? 0,
    times_correct: existing?.times_correct ?? 0,
    updated_at: now,
    created_at: existing?.created_at ?? now,
  };

  const { error } = await supabase
    .from("learner_phrase_progress")
    .upsert(payload, { onConflict: "learner_id,phrase_id" });

  return { error: error?.message ?? null };
}

export async function unpauseLearnerPhrase(
  learnerId: string,
  phraseId: number
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  const { data: phraseProgress, error: phraseProgressError } = await supabase
    .from("learner_phrase_progress")
    .select("id, times_seen, times_correct, next_review_at, last_reviewed_at, created_at")
    .eq("learner_id", learnerId)
    .eq("phrase_id", phraseId)
    .maybeSingle();

  if (phraseProgressError) {
    return { error: phraseProgressError.message };
  }

  const phrasePayload = {
    learner_id: learnerId,
    phrase_id: phraseId,
    status: "learning" as ProgressStatus,
    next_review_at: phraseProgress?.next_review_at ?? now,
    last_reviewed_at: phraseProgress?.last_reviewed_at ?? null,
    times_seen: phraseProgress?.times_seen ?? 0,
    times_correct: phraseProgress?.times_correct ?? 0,
    updated_at: now,
    created_at: phraseProgress?.created_at ?? now,
  };

  const { error: phraseError } = await supabase
    .from("learner_phrase_progress")
    .upsert(phrasePayload, { onConflict: "learner_id,phrase_id" });

  if (phraseError) {
    return { error: phraseError.message };
  }

  const { data: approvedItems, error: approvedItemsError } = await supabase
    .from("practice_items")
    .select("id")
    .eq("phrase_id", phraseId)
    .eq("status", "approved")
    .eq("exercise_type", "sentence_gap_fill");

  if (approvedItemsError) {
    return { error: approvedItemsError.message };
  }

  const approvedItemIds = (approvedItems ?? []).map((item) => item.id);

  if (approvedItemIds.length > 0) {
    const { error: itemProgressError } = await supabase
      .from("learner_practice_item_progress")
      .update({ status: "learning", updated_at: now })
      .eq("learner_id", learnerId)
      .eq("status", "paused")
      .in("practice_item_id", approvedItemIds);

    if (itemProgressError) {
      return { error: itemProgressError.message };
    }
  }

  return { error: null };
}

export async function loadApprovedPracticeItems(): Promise<PracticeItem[]> {
  const { data: rows, error } = await supabase
    .from("practice_items")
    .select(
      "id, phrase_id, message_draft_id, exercise_type, difficulty, italian_translation, prompt, correct_answer, acceptable_answers, hint, explanation, status, created_at"
    )
    .eq("status", "approved")
    .eq("exercise_type", "sentence_gap_fill")
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const phraseIds = Array.from(new Set(rows.map((r) => r.phrase_id)));
  const messageDraftIds = Array.from(
    new Set(rows.map((r) => r.message_draft_id).filter((id): id is number => !!id))
  );

  const [phraseRes, messageRes] = await Promise.all([
    phraseIds.length > 0
      ? supabase.from("phrases").select("id, phrase, category, level").in("id", phraseIds)
      : Promise.resolve({ data: [], error: null }),
    messageDraftIds.length > 0
      ? supabase.from("message_drafts").select("id, message_text").in("id", messageDraftIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const phraseMap = Object.fromEntries(
    (phraseRes.data ?? []).map((p) => [p.id, p])
  ) as Record<number, { id: number; phrase: string; category: string | null; level: string | null }>;

  const messageMap = Object.fromEntries(
    (messageRes.data ?? []).map((m) => [m.id, m.message_text])
  ) as Record<number, string>;

  return rows.map((row) => ({
    id: row.id,
    phrase_id: row.phrase_id,
    message_draft_id: row.message_draft_id,
    exercise_type: row.exercise_type,
    difficulty: toDifficulty(row.difficulty),
    italian_translation: row.italian_translation,
    prompt: row.prompt,
    correct_answer: row.correct_answer,
    acceptable_answers: row.acceptable_answers,
    hint: row.hint,
    explanation: row.explanation,
    status: row.status,
    created_at: row.created_at,
    phrase_text: phraseMap[row.phrase_id]?.phrase ?? "Unknown phrase",
    phrase_category: phraseMap[row.phrase_id]?.category ?? null,
    phrase_level: phraseMap[row.phrase_id]?.level ?? null,
    message_text: row.message_draft_id ? messageMap[row.message_draft_id] ?? null : null,
  }));
}

export async function loadLearnerPracticeProgress(
  learnerId: string
): Promise<LearnerPracticeItemProgress[]> {
  const { data, error } = await supabase
    .from("learner_practice_item_progress")
    .select("*")
    .eq("learner_id", learnerId);

  if (error || !data) return [];
  return data as LearnerPracticeItemProgress[];
}

function addHours(hours: number): string {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  return now.toISOString();
}

function addDays(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

function parseMaybeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hoursSince(value: string | null, now: Date): number {
  if (!value) return Number.POSITIVE_INFINITY;
  return (now.getTime() - new Date(value).getTime()) / (1000 * 60 * 60);
}

function isPhraseEligibleForReview(progress: LearnerPhraseProgress, now: Date): boolean {
  if (progress.status === "paused") return false;
  if (!["new", "learning", "reviewing", "mastered"].includes(progress.status)) {
    return false;
  }
  if (progress.next_review_at && new Date(progress.next_review_at) > now) return false;
  if (progress.last_reviewed_at && hoursSince(progress.last_reviewed_at, now) < 12) {
    return false;
  }
  return true;
}

function getRequiredDifficulty(progress: LearnerPhraseProgress | null): PracticeDifficulty {
  if (!progress) return "easy";
  if (progress.status === "mastered") return "hard";
  return progress.current_difficulty ?? "easy";
}

function getVisiblePhraseIds(sentDrafts: SentMessageDraft[]): Set<number> {
  return new Set(sentDrafts.map((draft) => draft.phrase_id));
}

function getItemsByPhrase(items: PracticeItem[]): Map<number, PracticeItem[]> {
  const itemsByPhrase = new Map<number, PracticeItem[]>();

  for (const item of items) {
    const list = itemsByPhrase.get(item.phrase_id) ?? [];
    list.push(item);
    itemsByPhrase.set(item.phrase_id, list);
  }

  return itemsByPhrase;
}

function selectPracticeItemForDifficulty(
  phraseItems: PracticeItem[],
  difficulty: PracticeDifficulty,
  progressByItemId: Map<number, LearnerPracticeItemProgress>
): PracticeItem | null {
  const candidates = phraseItems.filter((item) => item.difficulty === difficulty);

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((left, right) => {
    const leftProgress = progressByItemId.get(left.id);
    const rightProgress = progressByItemId.get(right.id);

    const leftSeen = parseMaybeNumber(leftProgress?.times_seen);
    const rightSeen = parseMaybeNumber(rightProgress?.times_seen);
    if (leftSeen !== rightSeen) return leftSeen - rightSeen;

    const leftReviewed = leftProgress?.last_reviewed_at ?? "1970-01-01T00:00:00.000Z";
    const rightReviewed = rightProgress?.last_reviewed_at ?? "1970-01-01T00:00:00.000Z";
    if (leftReviewed !== rightReviewed) return leftReviewed.localeCompare(rightReviewed);

    return left.id - right.id;
  });

  return sorted[0] ?? null;
}

function getResultMappedStatus(result: ReviewResult): ProgressStatus {
  if (result === "good") return "reviewing";
  if (result === "easy") return "mastered";
  return "learning";
}

type PhraseProgressTransition = {
  status: ProgressStatus;
  currentDifficulty: PracticeDifficulty;
  nextReviewAt: string;
  masteryIntervalDays: number;
  masteredAt: string | null;
  lastMasteryReviewAt: string | null;
};

function calculateNextPhraseProgressState(
  currentProgress: LearnerPhraseProgress | null,
  itemDifficulty: PracticeDifficulty,
  nextPracticeConsecutive: number,
  result: ReviewResult,
  nowIso: string
): PhraseProgressTransition {
  const currentStatus = currentProgress?.status ?? "new";
  const currentDifficulty = getRequiredDifficulty(currentProgress);
  const currentMasteryInterval = currentProgress?.mastery_interval_days ?? 3;
  const isCorrectOutcome = result === "good" || result === "hard" || result === "easy";

  if (currentStatus === "mastered") {
    if (isCorrectOutcome) {
      const increasedInterval = currentMasteryInterval + 2;
      return {
        status: "mastered",
        currentDifficulty: "hard",
        nextReviewAt: addDays(increasedInterval),
        masteryIntervalDays: increasedInterval,
        masteredAt: currentProgress?.mastered_at ?? nowIso,
        lastMasteryReviewAt: nowIso,
      };
    }

    return {
      status: "reviewing",
      currentDifficulty: "hard",
      nextReviewAt: addHours(24),
      masteryIntervalDays: 3,
      masteredAt: currentProgress?.mastered_at ?? nowIso,
      lastMasteryReviewAt: currentProgress?.last_mastery_review_at ?? null,
    };
  }

  if (currentDifficulty === "easy") {
    if (isCorrectOutcome && itemDifficulty === "easy" && nextPracticeConsecutive >= 2) {
      return {
        status: "reviewing",
        currentDifficulty: "medium",
        nextReviewAt: addHours(24),
        masteryIntervalDays: currentMasteryInterval,
        masteredAt: currentProgress?.mastered_at ?? null,
        lastMasteryReviewAt: currentProgress?.last_mastery_review_at ?? null,
      };
    }

    return {
      status: "learning",
      currentDifficulty: "easy",
      nextReviewAt: addHours(12),
      masteryIntervalDays: currentMasteryInterval,
      masteredAt: currentProgress?.mastered_at ?? null,
      lastMasteryReviewAt: currentProgress?.last_mastery_review_at ?? null,
    };
  }

  if (currentDifficulty === "medium") {
    if (isCorrectOutcome && itemDifficulty === "medium" && nextPracticeConsecutive >= 2) {
      return {
        status: "reviewing",
        currentDifficulty: "hard",
        nextReviewAt: addHours(24),
        masteryIntervalDays: currentMasteryInterval,
        masteredAt: currentProgress?.mastered_at ?? null,
        lastMasteryReviewAt: currentProgress?.last_mastery_review_at ?? null,
      };
    }

    return {
      status: isCorrectOutcome ? "reviewing" : "learning",
      currentDifficulty: "medium",
      nextReviewAt: addHours(24),
      masteryIntervalDays: currentMasteryInterval,
      masteredAt: currentProgress?.mastered_at ?? null,
      lastMasteryReviewAt: currentProgress?.last_mastery_review_at ?? null,
    };
  }

  if (isCorrectOutcome && itemDifficulty === "hard" && nextPracticeConsecutive >= 3) {
    const masteryIntervalDays = currentMasteryInterval || 3;
    return {
      status: "mastered",
      currentDifficulty: "hard",
      nextReviewAt: addDays(masteryIntervalDays),
      masteryIntervalDays,
      masteredAt: currentProgress?.mastered_at ?? nowIso,
      lastMasteryReviewAt: nowIso,
    };
  }

  return {
    status: isCorrectOutcome ? "reviewing" : "reviewing",
    currentDifficulty: "hard",
    nextReviewAt: addHours(24),
    masteryIntervalDays: currentMasteryInterval,
    masteredAt: currentProgress?.mastered_at ?? null,
    lastMasteryReviewAt: currentProgress?.last_mastery_review_at ?? null,
  };
}

export async function loadLearnerStudySummary(learnerId: string): Promise<StudySummary> {
  const [items, progress, phraseProgress, sentDrafts] = await Promise.all([
    loadApprovedPracticeItems(),
    loadLearnerPracticeProgress(learnerId),
    loadLearnerProgress(learnerId),
    loadSentDrafts(),
  ]);

  const now = new Date();
  const progressByItemId = new Map(progress.map((p) => [p.practice_item_id, p]));
  const sentPhraseIds = getVisiblePhraseIds(sentDrafts);
  const pausedPhraseIds = new Set(
    phraseProgress.filter((p) => p.status === "paused").map((p) => p.phrase_id)
  );
  const visibleItems = items.filter(
    (item) => sentPhraseIds.has(item.phrase_id) && !pausedPhraseIds.has(item.phrase_id)
  );
  const itemsByPhrase = getItemsByPhrase(visibleItems);
  const phraseProgressById = new Map(phraseProgress.map((p) => [p.phrase_id, p]));

  const duePhraseIds = new Set<number>();
  for (const phraseEntry of phraseProgress) {
    if (!sentPhraseIds.has(phraseEntry.phrase_id)) continue;
    if (pausedPhraseIds.has(phraseEntry.phrase_id)) continue;
    if (!isPhraseEligibleForReview(phraseEntry, now)) continue;

    const phraseItems = itemsByPhrase.get(phraseEntry.phrase_id) ?? [];
    const requiredDifficulty = getRequiredDifficulty(phraseEntry);
    const selectedItem = selectPracticeItemForDifficulty(
      phraseItems,
      requiredDifficulty,
      progressByItemId
    );

    if (!selectedItem) continue;
    duePhraseIds.add(phraseEntry.phrase_id);
  }

  const newPhraseIds = new Set<number>();
  for (const [phraseId, phraseItems] of itemsByPhrase.entries()) {
    if (phraseProgressById.has(phraseId)) continue;

    const easyItem = selectPracticeItemForDifficulty(phraseItems, "easy", progressByItemId);
    if (!easyItem) continue;
    newPhraseIds.add(phraseId);
  }

  const mastered = phraseProgress.filter((p) => p.status === "mastered").length;

  const readyPhraseIds = new Set<number>([...duePhraseIds, ...newPhraseIds]);

  return {
    readyToPractice: readyPhraseIds.size,
    newAvailable: newPhraseIds.size,
    reviewDue: duePhraseIds.size,
    mastered,
  };
}

export async function buildStudySession(
  learnerId: string,
  maxItems = 5,
  phraseId?: number
): Promise<StudySessionItem[]> {
  const [items, progress, phraseProgress, sentDrafts] = await Promise.all([
    loadApprovedPracticeItems(),
    loadLearnerPracticeProgress(learnerId),
    loadLearnerProgress(learnerId),
    loadSentDrafts(),
  ]);

  const now = new Date();
  const sentPhraseIds = getVisiblePhraseIds(sentDrafts);
  const pausedPhraseIds = new Set(
    phraseProgress.filter((p) => p.status === "paused").map((p) => p.phrase_id)
  );

  const scopedItems = items.filter(
    (item) => sentPhraseIds.has(item.phrase_id) && !pausedPhraseIds.has(item.phrase_id)
  );

  const progressByItemId = new Map(progress.map((p) => [p.practice_item_id, p]));
  const itemsByPhrase = getItemsByPhrase(scopedItems);
  const phraseProgressById = new Map(phraseProgress.map((p) => [p.phrase_id, p]));

  if (phraseId != null) {
    const currentPhraseProgress = phraseProgressById.get(phraseId) ?? null;
    if (currentPhraseProgress?.status === "paused") return [];

    const phraseItems = itemsByPhrase.get(phraseId) ?? [];
    const requiredDifficulty = getRequiredDifficulty(currentPhraseProgress);
    const selectedItem = selectPracticeItemForDifficulty(
      phraseItems,
      requiredDifficulty,
      progressByItemId
    );

    if (!selectedItem) return [];

    return [
      {
        practiceItem: selectedItem,
        practiceProgress: progressByItemId.get(selectedItem.id) ?? null,
        phraseProgress: currentPhraseProgress,
      },
    ];
  }

  const due: Array<StudySessionItem & { sortDate: string | null }> = [];
  for (const phraseEntry of phraseProgress) {
    if (!sentPhraseIds.has(phraseEntry.phrase_id)) continue;
    if (pausedPhraseIds.has(phraseEntry.phrase_id)) continue;
    if (!isPhraseEligibleForReview(phraseEntry, now)) continue;

    const phraseItems = itemsByPhrase.get(phraseEntry.phrase_id) ?? [];
    const requiredDifficulty = getRequiredDifficulty(phraseEntry);
    const selectedItem = selectPracticeItemForDifficulty(
      phraseItems,
      requiredDifficulty,
      progressByItemId
    );

    if (!selectedItem) continue;

    due.push({
      practiceItem: selectedItem,
      practiceProgress: progressByItemId.get(selectedItem.id) ?? null,
      phraseProgress: phraseEntry,
      sortDate: phraseEntry.next_review_at,
    });
  }

  due.sort((left, right) => {
    const leftDate = left.sortDate ?? "1970-01-01T00:00:00.000Z";
    const rightDate = right.sortDate ?? "1970-01-01T00:00:00.000Z";
    return leftDate.localeCompare(rightDate);
  });

  const fresh: StudySessionItem[] = [];
  for (const [currentPhraseId, phraseItems] of itemsByPhrase.entries()) {
    if (phraseProgressById.has(currentPhraseId)) continue;

    const easyItem = selectPracticeItemForDifficulty(phraseItems, "easy", progressByItemId);
    if (!easyItem) continue;

    fresh.push({
      practiceItem: easyItem,
      practiceProgress: progressByItemId.get(easyItem.id) ?? null,
      phraseProgress: null,
    });
  }

  const normalizedDue: StudySessionItem[] = due.map((item) => ({
    practiceItem: item.practiceItem,
    practiceProgress: item.practiceProgress,
    phraseProgress: item.phraseProgress,
  }));

  return [...normalizedDue, ...fresh].slice(0, maxItems);
}

export async function selectNextPracticeItemForPhrase(
  learnerId: string,
  phraseId: number
): Promise<PracticeItem | null> {
  const session = await buildStudySession(learnerId, 1, phraseId);
  return session[0]?.practiceItem ?? null;
}

export async function countApprovedPracticeItems(): Promise<number> {
  const { count } = await supabase
    .from("practice_items")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .eq("exercise_type", "sentence_gap_fill");
  return count ?? 0;
}

export async function submitStudyResult(
  learnerId: string,
  item: PracticeItem,
  result: ReviewResult
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  const { data: existingProgress, error: progressFetchError } = await supabase
    .from("learner_practice_item_progress")
    .select("id, times_seen, times_correct, consecutive_correct, created_at")
    .eq("learner_id", learnerId)
    .eq("practice_item_id", item.id)
    .maybeSingle();

  if (progressFetchError) return { error: progressFetchError.message };

  const isCorrectOutcome = result === "good" || result === "hard" || result === "easy";
  const currentTimesSeen = parseMaybeNumber(existingProgress?.times_seen);
  const currentTimesCorrect = parseMaybeNumber(existingProgress?.times_correct);
  const currentConsecutive = parseMaybeNumber(existingProgress?.consecutive_correct);

  const nextConsecutive = result === "again" ? 0 : currentConsecutive + 1;

  const { data: existingPhraseProgress, error: phraseFetchError } = await supabase
    .from("learner_phrase_progress")
    .select(
      "id, status, current_difficulty, mastery_interval_days, mastered_at, last_mastery_review_at, times_seen, times_correct, created_at"
    )
    .eq("learner_id", learnerId)
    .eq("phrase_id", item.phrase_id)
    .maybeSingle();

  if (phraseFetchError) return { error: phraseFetchError.message };

  const nextPhraseState = calculateNextPhraseProgressState(
    (existingPhraseProgress as LearnerPhraseProgress | null) ?? null,
    item.difficulty,
    nextConsecutive,
    result,
    now
  );

  const practiceStatus = getResultMappedStatus(result);

  const progressPayload = {
    learner_id: learnerId,
    practice_item_id: item.id,
    status: practiceStatus,
    times_seen: currentTimesSeen + 1,
    times_correct: isCorrectOutcome ? currentTimesCorrect + 1 : currentTimesCorrect,
    consecutive_correct: nextConsecutive,
    last_result: result,
    last_reviewed_at: now,
    next_review_at: nextPhraseState.nextReviewAt,
    updated_at: now,
    created_at: existingProgress?.created_at ?? now,
  };

  const { error: progressError } = await supabase
    .from("learner_practice_item_progress")
    .upsert(progressPayload, { onConflict: "learner_id,practice_item_id" });

  if (progressError) return { error: progressError.message };

  const { error: eventError } = await supabase.from("review_events").insert({
    learner_id: learnerId,
    phrase_id: item.phrase_id,
    practice_item_id: item.id,
    message_draft_id: item.message_draft_id,
    result,
    reviewed_at: now,
    next_review_at: nextPhraseState.nextReviewAt,
  });

  if (eventError) return { error: eventError.message };

  const phraseTimesSeen = parseMaybeNumber(existingPhraseProgress?.times_seen);
  const phraseTimesCorrect = parseMaybeNumber(existingPhraseProgress?.times_correct);

  const phrasePayload = {
    learner_id: learnerId,
    phrase_id: item.phrase_id,
    status: nextPhraseState.status,
    current_difficulty: nextPhraseState.currentDifficulty,
    mastery_interval_days: nextPhraseState.masteryIntervalDays,
    mastered_at: nextPhraseState.masteredAt,
    last_mastery_review_at: nextPhraseState.lastMasteryReviewAt,
    next_review_at: nextPhraseState.nextReviewAt,
    last_reviewed_at: now,
    times_seen: phraseTimesSeen + 1,
    times_correct: isCorrectOutcome ? phraseTimesCorrect + 1 : phraseTimesCorrect,
    updated_at: now,
    created_at: existingPhraseProgress?.created_at ?? now,
  };

  const { error: phraseError } = await supabase
    .from("learner_phrase_progress")
    .upsert(phrasePayload, { onConflict: "learner_id,phrase_id" });

  if (phraseError) return { error: phraseError.message };

  return { error: null };
}

export function normaliseAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

export const normalizeAnswer = normaliseAnswer;

export function getAcceptableAnswers(item: PracticeItem): string[] {
  const answers: string[] = [];

  if (item.correct_answer) answers.push(item.correct_answer);

  if (Array.isArray(item.acceptable_answers)) {
    for (const answer of item.acceptable_answers) {
      if (typeof answer === "string" && answer.trim()) {
        answers.push(answer.trim());
      }
    }
  }

  return Array.from(new Set(answers));
}

export function isAnswerCorrect(userAnswer: string, item: PracticeItem): boolean {
  const normalizedUser = normaliseAnswer(userAnswer);
  if (!normalizedUser) return false;

  const answers = getAcceptableAnswers(item).map(normaliseAnswer);
  return answers.includes(normalizedUser);
}

export function checkGapFillAnswer(
  userAnswer: string,
  item: PracticeItem
): "correct" | "incorrect" {
  return isAnswerCorrect(userAnswer, item) ? "correct" : "incorrect";
}

export async function submitReviewResult(
  learnerId: string,
  phraseId: number,
  messageDraftId: number,
  _progressId: number,
  _currentTimesSeen: number,
  _currentTimesCorrect: number,
  result: ReviewResult
): Promise<{ error: string | null }> {
  const fakeItem: PracticeItem = {
    id: 0,
    phrase_id: phraseId,
    message_draft_id: messageDraftId,
    exercise_type: "sentence_gap_fill",
    difficulty: "easy",
    italian_translation: null,
    prompt: "",
    correct_answer: "",
    acceptable_answers: [],
    hint: null,
    explanation: null,
    status: "approved",
    created_at: new Date().toISOString(),
    phrase_text: "",
    phrase_category: null,
    phrase_level: null,
    message_text: null,
  };

  return submitStudyResult(learnerId, fakeItem, result);
}
