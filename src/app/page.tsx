"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  UserRole,
  LearnerProfile,
  loadUserRole,
  loadLearnerProfile,
} from "@/lib/helpers";
import Nav, { AppView } from "@/components/Nav";
import AdminDashboard from "@/components/AdminDashboard";
import LearnerDashboard from "@/components/LearnerDashboard";
import LearnerLibrary from "@/components/LearnerLibrary";
import LearnerStudySession from "@/components/LearnerStudySession";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile | null>(null);
  const [activeView, setActiveView] = useState<AppView>("admin");
  const [practicePhraseId, setPracticePhraseId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await setupUserSession(data.user.email ?? "", data.user.id);
    } else {
      setIsLoggedIn(false);
    }
    setLoading(false);
  }

  async function setupUserSession(userEmail: string, userId: string) {
    const detectedRole = await loadUserRole(userEmail, userId);
    setRole(detectedRole);
    setIsLoggedIn(true);

    if (detectedRole === "admin") {
      setActiveView("admin");
    } else if (detectedRole === "learner") {
      const profile = await loadLearnerProfile(userId);
      setLearnerProfile(profile);
      setActiveView("learner-dashboard");
    }
  }

  async function signIn() {
    setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoginError(error.message);
      return;
    }

    if (data.user) {
      await setupUserSession(data.user.email ?? "", data.user.id);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setRole(null);
    setLearnerProfile(null);
    setPracticePhraseId(null);
  }

  function openStudySession(phraseId?: number) {
    setPracticePhraseId(phraseId ?? null);
    setActiveView("learner-study");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-slate-700">Loading…</p>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">English Phrase</h1>
          <p className="mt-2 text-sm text-slate-600">
            Log in to access your dashboard.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </div>

            <button
              onClick={signIn}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Log in
            </button>

            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          </div>
        </div>
      </main>
    );
  }

  if (role === "none") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          <h2 className="text-xl font-semibold text-slate-900">No access configured</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your account has not been set up as an admin or learner. Please contact support.
          </p>
          <button
            onClick={signOut}
            className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {role && (
        <Nav
          role={role}
          activeView={activeView}
          onNavigate={setActiveView}
          onSignOut={signOut}
        />
      )}

      {role === "admin" && activeView === "admin" && <AdminDashboard />}

      {role === "learner" && learnerProfile && activeView === "learner-dashboard" && (
        <LearnerDashboard
          learnerProfile={learnerProfile}
          onStartStudy={() => openStudySession()}
          onNavigateToLibrary={() => setActiveView("learner-library")}
        />
      )}

      {role === "learner" && learnerProfile && activeView === "learner-library" && (
        <LearnerLibrary
          learnerProfile={learnerProfile}
          onPracticePhrase={(phraseId) => openStudySession(phraseId)}
        />
      )}

      {role === "learner" && learnerProfile && activeView === "learner-study" && (
        <LearnerStudySession
          learnerProfile={learnerProfile}
          practicePhraseId={practicePhraseId}
          onBackToDashboard={() => {
            setPracticePhraseId(null);
            setActiveView("learner-dashboard");
          }}
        />
      )}
    </div>
  );
}
