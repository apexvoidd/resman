import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-6">
      <div className="space-y-6 text-center">
        <div className="text-5xl" aria-hidden="true">🍽️</div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Restaurant Management System
        </h1>
        <p className="text-xl font-medium opacity-60">
          {userId ? "Welcome back! You are signed in." : "Project Initialized Successfully"}
        </p>
        {userId && (
          <div className="flex flex-col items-center gap-4 pt-2">
            <UserButton />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="/settings"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm rounded-lg transition-colors border border-slate-700"
              >
                Restaurant Settings
              </a>
              <a
                href="/staff"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm rounded-lg transition-colors border border-slate-700"
              >
                Manage Staff
              </a>
              <a
                href="/tables"
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-orange-500/20"
              >
                Table Management
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
