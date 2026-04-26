"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Phrase = {
  id: number;
  phrase: string;
  category: string | null;
  level: string | null;
  rating: number | null;
  status: string;
  suggested_reason: string | null;
  created_by: string | null;
  created_at: string;
};

type MessageDraft = {
  id: number;
  phrase_id: number;
  phrase_text: string;
  message_text: string;
  status: string;
  created_at: string;
};

type PracticeItemDraft = {
  id: number;
  phrase_id: number;
  phrase_text: string;
  difficulty: "easy" | "medium" | "hard";
  italian_translation: string | null;
  prompt: string;
  correct_answer: string;
  acceptable_answers: unknown;
  hint: string | null;
  explanation: string | null;
  created_at: string;
};

type PracticeItemEdit = {
  italian_translation: string;
  prompt: string;
  correct_answer: string;
  acceptable_answers_text: string;
  hint: string;
  explanation: string;
};

type Tab = "phrases" | "messages" | "practice";
type PhraseFilter = "candidate" | "approved" | "rejected";
type DraftFilter = "draft" | "approved" | "rejected";

function acceptableAnswersToText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join("\n");
  }
  return "";
}

function parseAcceptableAnswers(input: string): string[] {
  const normalized = input.replace(/,/g, "\n");
  return Array.from(
    new Set(
      normalized
        .split("\n")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("phrases");
  const [phraseFilter, setPhraseFilter] = useState<PhraseFilter>("candidate");
  const [draftFilter, setDraftFilter] = useState<DraftFilter>("draft");

  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [messageDrafts, setMessageDrafts] = useState<MessageDraft[]>([]);
  const [editedDrafts, setEditedDrafts] = useState<Record<number, string>>({});

  const [practiceItems, setPracticeItems] = useState<PracticeItemDraft[]>([]);
  const [editedPracticeItems, setEditedPracticeItems] = useState<Record<number, PracticeItemEdit>>({});

  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPhrases("candidate");
    loadMessageDrafts("draft");
    loadPracticeItems();
  }, []);

  async function loadPhrases(status: PhraseFilter) {
    setPhraseFilter(status);
    const { data, error } = await supabase
      .from("phrases")
      .select(
        "id, phrase, category, level, rating, status, suggested_reason, created_by, created_at"
      )
      .eq("status", status)
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setPhrases(data ?? []);
  }

  async function loadMessageDrafts(status: DraftFilter) {
    setDraftFilter(status);
    const { data: drafts, error: draftsError } = await supabase
      .from("message_drafts")
      .select("id, phrase_id, message_text, status, created_at")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (draftsError) {
      setMessage(draftsError.message);
      return;
    }

    const phraseIds = Array.from(
      new Set((drafts ?? []).map((draft) => draft.phrase_id))
    );

    let phraseMap: Record<number, string> = {};

    if (phraseIds.length > 0) {
      const { data: phraseRows, error: phraseError } = await supabase
        .from("phrases")
        .select("id, phrase")
        .in("id", phraseIds);

      if (phraseError) {
        setMessage(phraseError.message);
        return;
      }

      phraseMap = Object.fromEntries(
        (phraseRows ?? []).map((phrase) => [phrase.id, phrase.phrase])
      );
    }

    const mappedDrafts: MessageDraft[] = (drafts ?? []).map((draft) => ({
      id: draft.id,
      phrase_id: draft.phrase_id,
      phrase_text: phraseMap[draft.phrase_id] ?? "Unknown phrase",
      message_text: draft.message_text,
      status: draft.status,
      created_at: draft.created_at,
    }));

    setMessageDrafts(mappedDrafts);

    const editState = Object.fromEntries(
      mappedDrafts.map((draft) => [draft.id, draft.message_text])
    );

    setEditedDrafts(editState);
  }

  async function loadPracticeItems() {
    const { data: rows, error } = await supabase
      .from("practice_items")
      .select(
        "id, phrase_id, difficulty, italian_translation, prompt, correct_answer, acceptable_answers, hint, explanation, created_at"
      )
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const phraseIds = Array.from(new Set((rows ?? []).map((row) => row.phrase_id)));

    let phraseMap: Record<number, string> = {};

    if (phraseIds.length > 0) {
      const { data: phraseRows, error: phraseError } = await supabase
        .from("phrases")
        .select("id, phrase")
        .in("id", phraseIds);

      if (phraseError) {
        setMessage(phraseError.message);
        return;
      }

      phraseMap = Object.fromEntries((phraseRows ?? []).map((p) => [p.id, p.phrase]));
    }

    const mapped: PracticeItemDraft[] = (rows ?? []).map((row) => ({
      id: row.id,
      phrase_id: row.phrase_id,
      phrase_text: phraseMap[row.phrase_id] ?? "Unknown phrase",
      difficulty: row.difficulty,
      italian_translation: row.italian_translation,
      prompt: row.prompt,
      correct_answer: row.correct_answer,
      acceptable_answers: row.acceptable_answers,
      hint: row.hint,
      explanation: row.explanation,
      created_at: row.created_at,
    }));

    setPracticeItems(mapped);

    const editState: Record<number, PracticeItemEdit> = Object.fromEntries(
      mapped.map((item) => [
        item.id,
        {
          italian_translation: item.italian_translation ?? "",
          prompt: item.prompt,
          correct_answer: item.correct_answer,
          acceptable_answers_text: acceptableAnswersToText(item.acceptable_answers),
          hint: item.hint ?? "",
          explanation: item.explanation ?? "",
        },
      ])
    );

    setEditedPracticeItems(editState);
  }

  async function updatePhraseStatus(id: number, newStatus: "approved" | "rejected") {
    setMessage("");
    const now = new Date().toISOString();
    const updatePayload =
      newStatus === "approved"
        ? { status: "approved", approved_at: now, reviewed_at: now }
        : { status: "rejected", rejected_at: now, reviewed_at: now };

    const { error } = await supabase.from("phrases").update(updatePayload).eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (phraseFilter === "candidate") {
      setPhrases((current) => current.filter((p) => p.id !== id));
    } else {
      await loadPhrases(phraseFilter);
    }
  }

  async function updateMessageDraftStatus(id: number, newStatus: "approved" | "rejected") {
    setMessage("");
    const now = new Date().toISOString();
    const editedText = editedDrafts[id];
    const updatePayload =
      newStatus === "approved"
        ? { message_text: editedText, status: "approved", approved_at: now }
        : { message_text: editedText, status: "rejected", rejected_at: now };

    const { error } = await supabase.from("message_drafts").update(updatePayload).eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (draftFilter === "draft") {
      setMessageDrafts((current) => current.filter((d) => d.id !== id));
    } else {
      await loadMessageDrafts(draftFilter);
    }
  }

  async function saveMessageDraft(id: number) {
    setMessage("");
    const editedText = editedDrafts[id];
    const { error } = await supabase
      .from("message_drafts")
      .update({ message_text: editedText })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Draft saved.");
  }

  async function savePracticeItem(id: number) {
    setMessage("");
    const edit = editedPracticeItems[id];
    if (!edit) return;

    const { error } = await supabase
      .from("practice_items")
      .update({
        italian_translation: edit.italian_translation || null,
        prompt: edit.prompt,
        correct_answer: edit.correct_answer,
        acceptable_answers: parseAcceptableAnswers(edit.acceptable_answers_text),
        hint: edit.hint || null,
        explanation: edit.explanation || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Practice item saved.");
  }

  async function updatePracticeItemStatus(id: number, newStatus: "approved" | "rejected") {
    setMessage("");
    const now = new Date().toISOString();

    const payload =
      newStatus === "approved"
        ? { status: "approved", approved_at: now, updated_at: now }
        : { status: "rejected", rejected_at: now, updated_at: now };

    const { error } = await supabase.from("practice_items").update(payload).eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPracticeItems((current) => current.filter((item) => item.id !== id));
    setMessage(`Practice item ${newStatus}.`);
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">Review and approve phrase content before sending to learners.</p>
      </div>

      <div className="mt-8 flex gap-2 rounded-xl bg-slate-200 p-1 w-fit">
        <button
          onClick={() => setActiveTab("phrases")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === "phrases" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"
          }`}
        >
          Phrases
        </button>

        <button
          onClick={() => setActiveTab("messages")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === "messages" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"
          }`}
        >
          Message drafts
        </button>

        <button
          onClick={() => setActiveTab("practice")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === "practice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"
          }`}
        >
          Practice items
        </button>
      </div>

      {activeTab === "phrases" && (
        <div className="mt-4 flex gap-2">
          {(["candidate", "approved", "rejected"] as PhraseFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => loadPhrases(s)}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
                phraseFilter === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {activeTab === "messages" && (
        <div className="mt-4 flex gap-2">
          {(["draft", "approved", "rejected"] as DraftFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => loadMessageDrafts(s)}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
                draftFilter === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {message}
        </div>
      )}

      {activeTab === "phrases" && (
        <div className="mt-6 space-y-4">
          {phrases.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-slate-700">No {phraseFilter} phrases.</p>
            </div>
          ) : (
            phrases.map((phrase) => (
              <div
                key={phrase.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{phrase.phrase}</h2>

                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {phrase.category && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          {phrase.category}
                        </span>
                      )}
                      {phrase.level && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          {phrase.level}
                        </span>
                      )}
                      {phrase.rating && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          {phrase.rating}/10
                        </span>
                      )}
                    </div>

                    {phrase.suggested_reason && <p className="mt-4 text-slate-700">{phrase.suggested_reason}</p>}
                  </div>

                  <div className="flex gap-2 md:flex-col">
                    {phraseFilter === "candidate" && (
                      <>
                        <button
                          onClick={() => updatePhraseStatus(phrase.id, "approved")}
                          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updatePhraseStatus(phrase.id, "rejected")}
                          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "messages" && (
        <div className="mt-6 space-y-6">
          {messageDrafts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-slate-700">No {draftFilter} message drafts.</p>
            </div>
          ) : (
            messageDrafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Phrase</p>
                    <h2 className="text-xl font-semibold text-slate-900">{draft.phrase_text}</h2>
                  </div>

                  <div className="flex gap-2">
                    {draftFilter === "draft" && (
                      <>
                        <button
                          onClick={() => saveMessageDraft(draft.id)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => updateMessageDraftStatus(draft.id, "approved")}
                          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateMessageDraftStatus(draft.id, "rejected")}
                          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <textarea
                  className="mt-5 min-h-80 w-full rounded-xl border border-slate-300 p-4 text-sm leading-6 text-slate-900"
                  value={editedDrafts[draft.id] ?? ""}
                  onChange={(e) =>
                    setEditedDrafts((current) => ({
                      ...current,
                      [draft.id]: e.target.value,
                    }))
                  }
                />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "practice" && (
        <div className="mt-6 space-y-6">
          {practiceItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-slate-700">No draft practice items.</p>
            </div>
          ) : (
            practiceItems.map((item) => {
              const edited = editedPracticeItems[item.id];
              if (!edited) return null;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Phrase</p>
                      <h2 className="text-xl font-semibold text-slate-900">{item.phrase_text}</h2>
                      <p className="mt-1 text-sm text-slate-600 capitalize">Difficulty: {item.difficulty}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => savePracticeItem(item.id)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => updatePracticeItemStatus(item.id, "approved")}
                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updatePracticeItemStatus(item.id, "rejected")}
                        className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Italian translation</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        value={edited.italian_translation}
                        onChange={(e) =>
                          setEditedPracticeItems((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              italian_translation: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Correct answer</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        value={edited.correct_answer}
                        onChange={(e) =>
                          setEditedPracticeItems((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              correct_answer: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Prompt</label>
                      <textarea
                        className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        value={edited.prompt}
                        onChange={(e) =>
                          setEditedPracticeItems((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              prompt: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Acceptable answers (one per line or comma-separated)
                      </label>
                      <textarea
                        className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        value={edited.acceptable_answers_text}
                        onChange={(e) =>
                          setEditedPracticeItems((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              acceptable_answers_text: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Hint</label>
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        value={edited.hint}
                        onChange={(e) =>
                          setEditedPracticeItems((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              hint: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Explanation</label>
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        value={edited.explanation}
                        onChange={(e) =>
                          setEditedPracticeItems((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              explanation: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
