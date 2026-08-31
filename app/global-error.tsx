'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 text-3xl font-bold">
            !
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black">Application Error</h2>
            <p className="text-sm text-slate-400">
              A critical error occurred. Please try reloading the page.
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-sky-500 transition-all"
          >
            Reload RailRadar24
          </button>
        </div>
      </body>
    </html>
  );
}
