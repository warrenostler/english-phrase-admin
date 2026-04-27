"use client";

import { UserRole } from "@/lib/helpers";

export type AppView = "admin" | "learner-dashboard" | "learner-library" | "learner-study";

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
        ? "bg-slate-900 text-white shadow-sm"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <nav className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="mr-7 flex items-center gap-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base font-bold text-slate-700 ring-1 ring-slate-200"
              aria-hidden="true"
            >
              V
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900">Verba</span>
          </div>

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
                onClick={() => onNavigate("learner-study")}
                className={linkClass("learner-study")}
              >
                Study
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
      </div>
    </nav>
  );
}
