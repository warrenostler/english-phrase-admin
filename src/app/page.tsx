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

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    setLoading(true);

    const { data } = await supabase.auth.getUser();

    if (data.user) {
      setIsLoggedIn(true);
      await loadCandidatePhrases();
    } else {
      setIsLoggedIn(false);
    }

    setLoading(false);
  }

  async function signIn() {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setIsLoggedIn(true);
    await loadCandidatePhrases();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setPhrases([]);
  }

  async function loadCandidatePhrases() {
    const { data, error } = await supabase
      .from("phrases")
      .select(
        "id, phrase, category, level, rating, status, suggested_reason, created_by, created_at"
      )
      .eq("status", "candidate")
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setPhrases(data ?? []);
  }

  async function updatePhraseStatus(
    id: number,
    newStatus: "approved" | "rejected"
  ) {
    setMessage("");

    const now = new Date().toISOString();

    const updatePayload =
      newStatus === "approved"
        ? {
            status: "approved",
            approved_at: now,
            reviewed_at: now,
          }
        : {
            status: "rejected",
            rejected_at: now,
            reviewed_at: now,
          };

    const { error } = await supabase
      .from("phrases")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPhrases((current) => current.filter((phrase) => phrase.id !== id));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-slate-700">Loading...</p>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">
            English Phrase Admin
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Log in to review AI-generated phrase suggestions.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>

            <button
              onClick={signIn}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Log in
            </button>

            {message && <p className="text-sm text-red-600">{message}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Candidate phrases
            </h1>
            <p className="mt-2 text-slate-600">
              Approve the strong ones. Reject anything too basic, odd, or textbooky.
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Log out
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="mt-8 space-y-4">
          {phrases.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-slate-700">No candidate phrases waiting.</p>
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
                      <p className="mt-4 text-slate-700">
                        {phrase.suggested_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 md:flex-col">
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
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
