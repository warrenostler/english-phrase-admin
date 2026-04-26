"use client";

import { UserRole } from "@/lib/helpers";

export type AppView = "admin" | "learner-dashboard" | "learner-library" | "learner-review";

type NavProps = {
  role: UserRole;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
};

export default function Nav({ role, activeView, onNavigate, onSignOut }: NavProps) {
  const linkClass = (view: AppView) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeView === view
        ? "bg-slate-900 text-white"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-1">
        <span className="mr-4 font-semibold text-slate-900">English Phrase</span>

        {role === "admin" && (
          <button
            onClick={() => onNavigate("admin")}
            className={linkClass("admin")}
          >
            Admin Dashboard
          </button>
        )}

        {role === "learner" && (
          <button
            onClick={() => onNavigate("learner-dashboard")}
            className={linkClass("learner-dashboard")}
          >
            Dashboard
          </button>
        )}

        {role === "learner" && (
          <>
            <button
              onClick={() => onNavigate("learner-library")}
              className={linkClass("learner-library")}
            >
              Library
            </button>
            <button
              onClick={() => onNavigate("learner-review")}
              className={linkClass("learner-review")}
            >
              Review
            </button>
          </>
        )}
      </div>

      <button
        onClick={onSignOut}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Log out
      </button>
    </nav>
  );
}
