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

function isDuePracticeProgress(progress: LearnerPracticeItemProgress, now: Date): boolean {
  if (progress.status === "paused") return false;
  if (progress.status === "mastered") return false;
  if (!["new", "learning", "reviewing"].includes(progress.status)) return false;
  if (!progress.next_review_at) return false;
  return new Date(progress.next_review_at) <= now;
}

function getPhraseConsecutive(
  phraseItems: PracticeItem[],
  progressByItemId: Map<number, LearnerPracticeItemProgress>,
  difficulty: PracticeDifficulty
): number {
  const matchingItems = phraseItems.filter((item) => item.difficulty === difficulty);
  let best = 0;

  for (const item of matchingItems) {
    const prog = progressByItemId.get(item.id);
    if (prog && prog.consecutive_correct > best) {
      best = prog.consecutive_correct;
    }
  }

  return best;
}

function isDifficultyUnlocked(
  phraseItems: PracticeItem[],
  progressByItemId: Map<number, LearnerPracticeItemProgress>,
  difficulty: PracticeDifficulty
): boolean {
  const easyConsecutive = getPhraseConsecutive(phraseItems, progressByItemId, "easy");
  const mediumConsecutive = getPhraseConsecutive(phraseItems, progressByItemId, "medium");

  if (difficulty === "easy") return true;
  if (difficulty === "medium") return easyConsecutive >= 2;
  return mediumConsecutive >= 2;
}

function getNextDifficultyForPhrase(
  phraseItems: PracticeItem[],
  progressByItemId: Map<number, LearnerPracticeItemProgress>
): PracticeDifficulty {
  const easyConsecutive = getPhraseConsecutive(phraseItems, progressByItemId, "easy");
  if (easyConsecutive < 2) return "easy";

  const mediumConsecutive = getPhraseConsecutive(phraseItems, progressByItemId, "medium");
  if (mediumConsecutive < 2) return "medium";

  return "hard";
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
  const itemsByPhrase = new Map<number, PracticeItem[]>();
  const sentPhraseIds = new Set(sentDrafts.map((d) => d.phrase_id));
  const pausedPhraseIds = new Set(
    phraseProgress.filter((p) => p.status === "paused").map((p) => p.phrase_id)
  );

  for (const item of items) {
    if (!sentPhraseIds.has(item.phrase_id)) continue;
    if (pausedPhraseIds.has(item.phrase_id)) continue;

    const list = itemsByPhrase.get(item.phrase_id) ?? [];
    list.push(item);
    itemsByPhrase.set(item.phrase_id, list);
  }

  const duePhraseIds = new Set<number>();
  const approvedItemIds = new Set(items.map((i) => i.id));
  const approvedItemById = new Map(items.map((i) => [i.id, i]));
  for (const p of progress) {
    if (!approvedItemIds.has(p.practice_item_id)) continue;
    if (!isDuePracticeProgress(p, now)) continue;

    const item = approvedItemById.get(p.practice_item_id);
    if (!item) continue;
    if (!sentPhraseIds.has(item.phrase_id)) continue;
    if (pausedPhraseIds.has(item.phrase_id)) continue;
    duePhraseIds.add(item.phrase_id);
  }

  const newPhraseIds = new Set<number>();
  for (const item of items) {
    if (!sentPhraseIds.has(item.phrase_id)) continue;
    if (pausedPhraseIds.has(item.phrase_id)) continue;

    const hasProgress = progressByItemId.has(item.id);
    if (hasProgress) continue;

    const phraseItems = itemsByPhrase.get(item.phrase_id) ?? [];
    if (!isDifficultyUnlocked(phraseItems, progressByItemId, item.difficulty)) continue;
    if (item.difficulty !== getNextDifficultyForPhrase(phraseItems, progressByItemId)) continue;

    if (item.difficulty === "easy") {
      newPhraseIds.add(item.phrase_id);
    }
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
  const sentPhraseIds = new Set(sentDrafts.map((d) => d.phrase_id));
  const pausedPhraseIds = new Set(
    phraseProgress.filter((p) => p.status === "paused").map((p) => p.phrase_id)
  );

  const scopedItems = items.filter(
    (item) => sentPhraseIds.has(item.phrase_id) && !pausedPhraseIds.has(item.phrase_id)
  );

  const itemById = new Map(scopedItems.map((item) => [item.id, item]));
  const progressByItemId = new Map(progress.map((p) => [p.practice_item_id, p]));

  const itemsByPhrase = new Map<number, PracticeItem[]>();
  for (const item of scopedItems) {
    const list = itemsByPhrase.get(item.phrase_id) ?? [];
    list.push(item);
    itemsByPhrase.set(item.phrase_id, list);
  }

  const due: StudySessionItem[] = [];
  for (const prog of progress) {
    if (!isDuePracticeProgress(prog, now)) continue;
    const item = itemById.get(prog.practice_item_id);
    if (!item) continue;

    if (phraseId != null && item.phrase_id !== phraseId) continue;

    due.push({
      practiceItem: item,
      practiceProgress: prog,
    });
  }

  const dueIds = new Set(due.map((d) => d.practiceItem.id));

  const fresh: StudySessionItem[] = [];
  for (const item of scopedItems) {
    if (dueIds.has(item.id)) continue;
    if (phraseId != null && item.phrase_id !== phraseId) continue;

    const p = progressByItemId.get(item.id);
    if (p?.status === "paused") continue;
    if (p) continue;

    const phraseItems = itemsByPhrase.get(item.phrase_id) ?? [];
    const unlocked = isDifficultyUnlocked(phraseItems, progressByItemId, item.difficulty);
    if (!unlocked) continue;

    const nextDifficulty = getNextDifficultyForPhrase(phraseItems, progressByItemId);
    if (item.difficulty !== nextDifficulty) continue;

    fresh.push({
      practiceItem: item,
      practiceProgress: null,
    });
  }

  return [...due, ...fresh].slice(0, maxItems);
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

function addDays(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

function resultToSchedule(result: ReviewResult): { status: ProgressStatus; nextReviewAt: string } {
  if (result === "again") return { status: "learning", nextReviewAt: addDays(1) };
  if (result === "hard") return { status: "learning", nextReviewAt: addDays(3) };
  if (result === "good") return { status: "reviewing", nextReviewAt: addDays(7) };
  return { status: "mastered", nextReviewAt: addDays(30) };
}

function parseMaybeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function submitStudyResult(
  learnerId: string,
  item: PracticeItem,
  result: ReviewResult
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { status, nextReviewAt } = resultToSchedule(result);

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

  const nextConsecutive =
    result === "again" ? 0 : currentConsecutive + 1;

  const progressPayload = {
    learner_id: learnerId,
    practice_item_id: item.id,
    status,
    times_seen: currentTimesSeen + 1,
    times_correct: isCorrectOutcome ? currentTimesCorrect + 1 : currentTimesCorrect,
    consecutive_correct: nextConsecutive,
    last_result: result,
    last_reviewed_at: now,
    next_review_at: nextReviewAt,
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
    next_review_at: nextReviewAt,
  });

  if (eventError) return { error: eventError.message };

  const [allPhraseItems, allProgressRows, existingPhraseProgressRes] = await Promise.all([
    loadApprovedPracticeItems(),
    loadLearnerPracticeProgress(learnerId),
    supabase
      .from("learner_phrase_progress")
      .select("id, times_seen, times_correct, created_at")
      .eq("learner_id", learnerId)
      .eq("phrase_id", item.phrase_id)
      .maybeSingle(),
  ]);

  if (existingPhraseProgressRes.error) return { error: existingPhraseProgressRes.error.message };

  const phraseItems = allPhraseItems.filter((p) => p.phrase_id === item.phrase_id);
  const progressMap = new Map(allProgressRows.map((p) => [p.practice_item_id, p]));

  const easyConsecutive = getPhraseConsecutive(phraseItems, progressMap, "easy");
  const mediumConsecutive = getPhraseConsecutive(phraseItems, progressMap, "medium");
  const hardConsecutive = getPhraseConsecutive(phraseItems, progressMap, "hard");

  const phraseStatus: ProgressStatus =
    hardConsecutive >= 3
      ? "mastered"
      : (easyConsecutive >= 2 || mediumConsecutive >= 1 || hardConsecutive >= 1)
      ? "reviewing"
      : "learning";

  const currentDifficulty: PracticeDifficulty =
    easyConsecutive < 2 ? "easy" : mediumConsecutive < 2 ? "medium" : "hard";

  const phraseTimesSeen = parseMaybeNumber(existingPhraseProgressRes.data?.times_seen);
  const phraseTimesCorrect = parseMaybeNumber(existingPhraseProgressRes.data?.times_correct);

  const phrasePayload = {
    learner_id: learnerId,
    phrase_id: item.phrase_id,
    status: phraseStatus,
    current_difficulty: currentDifficulty,
    next_review_at: nextReviewAt,
    last_reviewed_at: now,
    times_seen: phraseTimesSeen + 1,
    times_correct: isCorrectOutcome ? phraseTimesCorrect + 1 : phraseTimesCorrect,
    updated_at: now,
    created_at: existingPhraseProgressRes.data?.created_at ?? now,
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
