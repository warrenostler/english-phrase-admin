"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LearnerProfile,
  ReviewResult,
  StudySessionItem,
  buildStudySession,
  checkGapFillAnswer,
  checkTypeThePhraseAnswer,
  getGapFillPrompt,
  normalizeAnswer,
  submitStudyResult,
} from "@/lib/helpers";

type Props = {
  learnerProfile: LearnerProfile;
  practicePhraseId?: number | null;
  onBackToDashboard: () => void;
};

type ExerciseType = "gap-fill" | "type-the-phrase";
type FeedbackState = "correct" | "almost" | "incorrect";

function extractMeaningHint(messageText: string): string {
  const firstLine = messageText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine?.slice(0, 180) ?? "Type the English phrase for this meaning.";
}

export default function LearnerStudySession({
  learnerProfile,
  practicePhraseId,
  onBackToDashboard,
}: Props) {
  const [items, setItems] = useState<StudySessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ReviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [summary, setSummary] = useState<{ good: number; hard: number; again: number }>({
    good: 0,
    hard: 0,
    again: 0,
  });

  const isDone = items.length > 0 && index >= items.length;
  const current = !isDone ? items[index] : null;

  const exerciseType: ExerciseType = useMemo(
    () => (index % 2 === 0 ? "gap-fill" : "type-the-phrase"),
    [index]
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      setIndex(0);
      setAnswer("");
      setAttempts(0);
      setRevealed(false);
      setFeedback(null);
      setResolvedResult(null);
      setSummary({ good: 0, hard: 0, again: 0 });

      const session = await buildStudySession(
        learnerProfile.id,
        5,
        practicePhraseId ?? undefined
      );

      if (!isMounted) return;
      setItems(session);
      setLoading(false);
    }

    load().catch((e: unknown) => {
      if (!isMounted) return;
      setError(e instanceof Error ? e.message : "Failed to load study session.");
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [learnerProfile.id, practicePhraseId]);

  async function resolveResult(result: ReviewResult, nextFeedback: FeedbackState) {
    if (!current) return;

    setSubmitting(true);
    setError(null);

    const { error: submitError } = await submitStudyResult(
      learnerProfile.id,
      current.draft.phrase_id,
      current.draft.id,
      result
    );

    if (submitError) {
      setError(submitError);
      setSubmitting(false);
      return;
    }

    setResolvedResult(result);
    setFeedback(nextFeedback);
    setRevealed(true);

    setSummary((prev) => ({
      ...prev,
      [result]: (prev as Record<string, number>)[result] + 1,
    }));

    setSubmitting(false);
  }

  async function checkAnswer() {
    if (!current) return;

    const phrase = current.draft.phrase_text;
    const evaluation =
      exerciseType === "gap-fill"
        ? checkGapFillAnswer(answer, phrase)
        : checkTypeThePhraseAnswer(answer, phrase);

    if (evaluation === "correct") {
      const result: ReviewResult = attempts === 0 ? "good" : "hard";
      await resolveResult(result, "correct");
      return;
    }

    if (evaluation === "almost") {
      setFeedback("almost");
      setAttempts((prev) => prev + 1);
      return;
    }

    setFeedback("incorrect");
    setAttempts((prev) => prev + 1);
  }

  async function showAnswer() {
    await resolveResult("again", feedback ?? "incorrect");
  }

  function nextPhrase() {
    setIndex((prev) => prev + 1);
    setAnswer("");
    setAttempts(0);
    setRevealed(false);
    setFeedback(null);
    setResolvedResult(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <p className="text-slate-600">Building your study session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">No phrases ready right now</h1>
          <p className="mt-2 text-slate-600">
            You are all caught up. Check back later for new phrases or scheduled review.
          </p>
          <button
            onClick={onBackToDashboard}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Session complete</h1>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-sm text-green-700">Correct</p>
              <p className="text-2xl font-semibold text-green-800">{summary.good}</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-4 text-center">
              <p className="text-sm text-orange-700">Hard</p>
              <p className="text-2xl font-semibold text-orange-800">{summary.hard}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-sm text-red-700">Again</p>
              <p className="text-2xl font-semibold text-red-800">{summary.again}</p>
            </div>
          </div>

          <button
            onClick={onBackToDashboard}
            className="mt-8 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const phrase = current.draft.phrase_text;
  const gapPrompt = getGapFillPrompt(phrase, current.draft.message_text);
  const meaningHint = extractMeaningHint(current.draft.message_text);
  const expectedAnswer = normalizeAnswer(phrase).startsWith("to ")
    ? `${phrase} (or ${phrase.replace(/^to\s+/i, "")})`
    : phrase;

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Study session</h1>
        <p className="text-sm text-slate-500">
          Phrase {index + 1} of {items.length}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-slate-900">{phrase}</p>
          {current.draft.phrase_category && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {current.draft.phrase_category}
            </span>
          )}
          {current.draft.phrase_level && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {current.draft.phrase_level}
            </span>
          )}
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          {exerciseType === "gap-fill" ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gap-fill</p>
              <p className="mt-2 text-slate-800">{gapPrompt}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Type the phrase</p>
              <p className="mt-2 text-slate-800">Type the English phrase for this meaning:</p>
              <p className="mt-2 text-sm text-slate-600">{meaningHint}</p>
            </>
          )}
        </div>

        <div className="mt-4">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={revealed || submitting}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            placeholder="Type your answer"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!revealed && (
            <>
              <button
                onClick={checkAnswer}
                disabled={submitting || !answer.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Check answer
              </button>
              <button
                onClick={showAnswer}
                disabled={submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Show answer
              </button>
            </>
          )}

          {revealed && (
            <button
              onClick={nextPhrase}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Next phrase
            </button>
          )}
        </div>

        {feedback && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-900">
              {feedback === "correct" ? "Correct" : feedback === "almost" ? "Almost / Not quite" : "Not quite"}
            </p>
            <p className="mt-2 text-slate-700">Expected answer: {expectedAnswer}</p>
            {resolvedResult && (
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                Session result: {resolvedResult}
              </p>
            )}
            <p className="mt-3 whitespace-pre-wrap text-slate-700">{current.draft.message_text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
