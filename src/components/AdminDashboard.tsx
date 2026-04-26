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

type Tab = "phrases" | "messages";
type PhraseFilter = "candidate" | "approved" | "rejected";
type DraftFilter = "draft" | "approved" | "rejected";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("phrases");
  const [phraseFilter, setPhraseFilter] = useState<PhraseFilter>("candidate");
  const [draftFilter, setDraftFilter] = useState<DraftFilter>("draft");

  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [messageDrafts, setMessageDrafts] = useState<MessageDraft[]>([]);
  const [editedDrafts, setEditedDrafts] = useState<Record<number, string>>({});

  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPhrases("candidate");
    loadMessageDrafts("draft");
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

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Review AI suggestions before anything can be sent.
        </p>
      </div>

      <div className="mt-8 flex gap-2 rounded-xl bg-slate-200 p-1 w-fit">
        <button
          onClick={() => setActiveTab("phrases")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === "phrases"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-700"
          }`}
        >
          Phrases
        </button>

        <button
          onClick={() => setActiveTab("messages")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === "messages"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-700"
          }`}
        >
          Message drafts
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
                    <h2 className="text-xl font-semibold text-slate-900">
                      {phrase.phrase}
                    </h2>

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

                    {phrase.suggested_reason && (
                      <p className="mt-4 text-slate-700">{phrase.suggested_reason}</p>
                    )}
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
                    <h2 className="text-xl font-semibold text-slate-900">
                      {draft.phrase_text}
                    </h2>
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
    </div>
  );
}
