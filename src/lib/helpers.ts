import { supabase } from "@/lib/supabaseClient";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  ease_score: number | null;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  times_seen: number;
  times_correct: number;
  created_at: string;
  updated_at: string;
};

export type ReviewResult = "again" | "hard" | "good" | "easy";

// ─── Role helpers ─────────────────────────────────────────────────────────────

export async function loadUserRole(email: string, userId: string): Promise<UserRole> {
  // admin_users may use id (linked to auth.users) or email — try both
  const [adminByIdResult, adminByEmailResult, learnerResult] = await Promise.all([
    supabase.from("admin_users").select("id").eq("id", userId).maybeSingle(),
    supabase.from("admin_users").select("id").eq("email", email).maybeSingle(),
    supabase.from("learner_profiles").select("id").eq("id", userId).maybeSingle(),
  ]);

  if (process.env.NODE_ENV === "development") {
    console.log("[loadUserRole]", {
      userId,
      email,
      adminById: adminByIdResult.data,
      adminByIdError: adminByIdResult.error?.message,
      adminByEmail: adminByEmailResult.data,
      adminByEmailError: adminByEmailResult.error?.message,
      learner: learnerResult.data,
      learnerError: learnerResult.error?.message,
    });
  }

  const isAdmin = !!(adminByIdResult.data || adminByEmailResult.data);
  const isLearner = !!learnerResult.data;

  if (isAdmin) return "admin";
  if (isLearner) return "learner";
  return "none";
}

// ─── Learner profile ──────────────────────────────────────────────────────────

export async function loadLearnerProfile(userId: string): Promise<LearnerProfile | null> {
  const { data, error } = await supabase
    .from("learner_profiles")
    .select("id, email, first_name, native_language, target_language, level")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as LearnerProfile;
}

// ─── Sent message drafts ──────────────────────────────────────────────────────

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

  const phraseMap: Record<number, { phrase: string; category: string | null; level: string | null; rating: number | null }> =
    Object.fromEntries(
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

// ─── Learner phrase progress ──────────────────────────────────────────────────

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
    .select("id, times_seen, times_correct")
    .eq("learner_id", learnerId)
    .eq("phrase_id", phraseId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("learner_phrase_progress")
      .update({ status, updated_at: now })
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  } else {
    const { error } = await supabase.from("learner_phrase_progress").insert({
      learner_id: learnerId,
      phrase_id: phraseId,
      status,
      next_review_at: now,
      times_seen: 0,
      times_correct: 0,
      created_at: now,
      updated_at: now,
    });
    return { error: error?.message ?? null };
  }
}

// ─── Review ───────────────────────────────────────────────────────────────────

function getNextReviewAt(result: ReviewResult): string {
  const now = new Date();
  const daysMap: Record<ReviewResult, number> = {
    again: 1,
    hard: 3,
    good: 7,
    easy: 30,
  };
  now.setDate(now.getDate() + daysMap[result]);
  return now.toISOString();
}

function getNextStatus(result: ReviewResult): ProgressStatus {
  if (result === "again" || result === "hard") return "learning";
  if (result === "good") return "reviewing";
  return "mastered";
}

export async function submitReviewResult(
  learnerId: string,
  phraseId: number,
  messageDraftId: number,
  progressId: number,
  currentTimesSeen: number,
  currentTimesCorrect: number,
  result: ReviewResult
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const nextReviewAt = getNextReviewAt(result);
  const newStatus = getNextStatus(result);
  const isCorrect = result === "good" || result === "easy";

  const [reviewInsert, progressUpdate] = await Promise.all([
    supabase.from("review_events").insert({
      learner_id: learnerId,
      phrase_id: phraseId,
      message_draft_id: messageDraftId,
      result,
      reviewed_at: now,
      next_review_at: nextReviewAt,
    }),
    supabase
      .from("learner_phrase_progress")
      .update({
        status: newStatus,
        last_reviewed_at: now,
        times_seen: currentTimesSeen + 1,
        times_correct: isCorrect ? currentTimesCorrect + 1 : currentTimesCorrect,
        next_review_at: nextReviewAt,
        updated_at: now,
      })
      .eq("id", progressId),
  ]);

  if (reviewInsert.error) return { error: reviewInsert.error.message };
  if (progressUpdate.error) return { error: progressUpdate.error.message };
  return { error: null };
}
