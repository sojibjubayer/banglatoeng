"use client";

import { FormEvent, useEffect, useState } from "react";

type EntryType = "sentence" | "vocabulary";
type Rating = "got-it" | "review";
type Entry = {
  _id: string;
  type: EntryType;
  bangla: string;
  english: string;
  category: string;
  example?: string;
};

const categories = ["Daily life", "Conversation", "Work", "Travel", "Grammar", "Other"];

export default function Home() {
  const [type, setType] = useState<EntryType>("sentence");
  const [view, setView] = useState<"practice" | "add" | "login">("practice");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<Entry | null>(null);
  const [category, setCategory] = useState("All categories");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loggingIn, setLoggingIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ bangla: "", english: "", category: "Daily life", example: "" });

  async function loadEntries(selected: EntryType, requestedPage = 1, selectedCategory = "All categories", selectLast = false) {
    setLoading(true);
    setNotice("");
    try {
      const params = new URLSearchParams({ type: selected, page: String(requestedPage) });
      if (selectedCategory !== "All categories") params.set("category", selectedCategory);
      const response = await fetch("/api/entries?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your library.");
      const loadedEntries = data.entries as Entry[];
      setEntries(loadedEntries);
      setPage(data.page);
      setTotalCount(data.total);
      setTotalPages(data.totalPages);
      setActive(loadedEntries.length ? loadedEntries[selectLast ? loadedEntries.length - 1 : 0] : null);
      setRevealed(false);
      setRating(null);
    } catch (error) {
      setEntries([]);
      setActive(null);
      setTotalCount(0);
      setTotalPages(1);
      setNotice(error instanceof Error ? error.message : "Could not connect to MongoDB.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCategory("All categories");
    setPage(1);
    setRatings({});
    void loadEntries(type, 1, "All categories");
  }, [type]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active) setIsAdmin(Boolean(data.isAdmin)); })
      .catch(() => { if (active) setIsAdmin(false); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);
  const currentIndex = active ? entries.findIndex((entry) => entry._id === active._id) : -1;
  const gotItCount = Object.values(ratings).filter((item) => item === "got-it").length;
  const reviewCount = Object.values(ratings).filter((item) => item === "review").length;

  function choose(entry: Entry | null) {
    setActive(entry);
    setRevealed(false);
    setRating(null);
  }

  function move(offset: number) {
    if (!entries.length) return;
    const nextIndex = currentIndex + offset;
    if (nextIndex >= 0 && nextIndex < entries.length) {
      choose(entries[nextIndex]);
    } else if (nextIndex < 0 && page > 1) {
      void loadEntries(type, page - 1, category, true);
    } else if (nextIndex >= entries.length && page < totalPages) {
      void loadEntries(type, page + 1, category);
    }
  }

  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    void loadEntries(type, nextPage, category);
  }

  function updateCategory(value: string) {
    setCategory(value);
    setPage(1);
    void loadEntries(type, 1, value);
  }

  function mark(value: Rating) {
    if (!active) return;
    setRating(value);
    setRatings((current) => ({ ...current, [active._id]: value }));
  }

  async function loginAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggingIn(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      setIsAdmin(true);
      setView("practice");
      setLoginForm((current) => ({ ...current, password: "" }));
      setNotice("Signed in as admin.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logoutAdmin() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setIsAdmin(false);
      setView("practice");
      setNotice("Signed out.");
    }
  }
  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save this entry.");
      setCategory("All categories");
      setPage(1);
      await loadEntries(type, 1, "All categories");
      setForm({ bangla: "", english: "", category: "Daily life", example: "" });
      setView("practice");
      setNotice("Saved to your library.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f3] px-3 pb-5 pt-3 text-[#20362e] sm:px-5 sm:pt-5">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d7f0df] text-lg font-semibold text-[#285741]">অ</span>
            <div className="min-w-0"><p className="truncate text-base font-semibold">Bhasha</p><p className="text-xs text-[#77877d]">Bangla to English</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {authLoading ? (
              <span className="text-xs text-[#829087]">Checking…</span>
            ) : isAdmin ? (
              <>
                <button type="button" onClick={() => { setView(view === "add" ? "practice" : "add"); setNotice(""); }} className="min-h-11 rounded-xl border border-[#dce5dc] bg-white px-3 text-sm font-semibold text-[#315d47] shadow-sm hover:bg-[#f9fcf9] sm:px-4">{view === "add" ? "Practice" : "+ Add"}</button>
                <button type="button" onClick={logoutAdmin} className="min-h-11 rounded-xl px-2 text-xs font-semibold text-[#718078] hover:bg-white sm:px-3">Log out</button>
              </>
            ) : (
              <button type="button" onClick={() => { setView(view === "login" ? "practice" : "login"); setNotice(""); }} className="min-h-11 rounded-xl border border-[#dce5dc] bg-white px-3 text-sm font-semibold text-[#315d47] shadow-sm hover:bg-[#f9fcf9] sm:px-4">{view === "login" ? "Cancel" : "Admin login"}</button>
            )}
          </div>
        </header>

        <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#e9eee8] p-1">
          <button type="button" onClick={() => setType("sentence")} aria-pressed={type === "sentence"} className={"min-h-10 rounded-lg px-3 text-sm font-semibold transition " + (type === "sentence" ? "bg-white text-[#285741] shadow-sm" : "text-[#7a887e]")}>Sentences</button>
          <button type="button" onClick={() => setType("vocabulary")} aria-pressed={type === "vocabulary"} className={"min-h-10 rounded-lg px-3 text-sm font-semibold transition " + (type === "vocabulary" ? "bg-white text-[#285741] shadow-sm" : "text-[#7a887e]")}>Vocabulary</button>
        </div>

        {notice && <p role="status" className="mb-4 rounded-xl border border-[#dce8dc] bg-white px-4 py-3 text-sm leading-5 text-[#496454]">{notice}</p>}

        {view === "login" ? (
          <section className="rounded-2xl border border-[#e3e9e1] bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#829087]">Admin access</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sign in to add entries</h1>
            <p className="mt-2 text-sm leading-5 text-[#7d8981]">Practice is open. Admin sign-in is only needed to add sentences or vocabulary.</p>
            <form onSubmit={loginAdmin} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">Admin email
                <input required type="email" autoComplete="username" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] px-4 text-base font-normal outline-none focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]" />
              </label>
              <label className="block text-sm font-semibold">Password
                <input required type="password" autoComplete="current-password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] px-4 text-base font-normal outline-none focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]" />
              </label>
              <button disabled={loggingIn} className="min-h-12 w-full rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white transition hover:bg-[#1f4934] disabled:opacity-60">{loggingIn ? "Signing in…" : "Sign in"}</button>
            </form>
          </section>
        ) : view === "add" && isAdmin ? (
          <section className="rounded-2xl border border-[#e3e9e1] bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#829087]">Your library</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add {type === "sentence" ? "a sentence" : "a word"}</h1>
            <p className="mt-2 text-sm leading-5 text-[#7d8981]">Enter one Bangla and English pair, then save it.</p>
            <form onSubmit={addEntry} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">
                Bangla {type === "sentence" ? "sentence" : "word"}
                <textarea required lang="bn" dir="auto" value={form.bangla} onChange={(event) => setForm({ ...form, bangla: event.target.value })} placeholder={type === "sentence" ? "আজ আবহাওয়া সুন্দর।" : "সুন্দর"} className="mt-2 min-h-24 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] p-4 text-lg font-normal leading-7 outline-none placeholder:text-[#adb5ae] focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]" />
              </label>
              <label className="block text-sm font-semibold">
                English {type === "sentence" ? "translation" : "meaning"}
                <textarea required value={form.english} onChange={(event) => setForm({ ...form, english: event.target.value })} placeholder={type === "sentence" ? "The weather is beautiful today." : "beautiful"} className="mt-2 min-h-24 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] p-4 text-base font-normal leading-6 outline-none placeholder:text-[#adb5ae] focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]" />
              </label>
              {type === "vocabulary" && <label className="block text-sm font-semibold">Example (optional)<input value={form.example} onChange={(event) => setForm({ ...form, example: event.target.value })} placeholder="The garden is beautiful." className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] px-4 text-base font-normal outline-none placeholder:text-[#adb5ae] focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]" /></label>}
              <label className="block text-sm font-semibold">Category
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-white px-4 text-base font-normal outline-none focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]">{categories.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <button disabled={saving} className="min-h-12 w-full rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white transition hover:bg-[#1f4934] disabled:opacity-60">{saving ? "Saving…" : "Save pair"}</button>
            </form>
          </section>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#829087]">Practice</p><h1 className="mt-0.5 text-xl font-semibold tracking-tight">{type === "sentence" ? "Translate in your head" : "Recall the meaning"}</h1></div>
              <select aria-label="Filter by category" value={category} onChange={(event) => updateCategory(event.target.value)} className="min-h-11 max-w-[48%] rounded-xl border border-[#dfe6de] bg-white px-3 text-sm outline-none focus:border-[#76ad8c]">
                <option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-xl border border-[#e3e9e1] bg-white px-3 py-2.5 text-xs">
              <span className="text-[#77877d]">{loading ? "Loading…" : entries.length ? "Card " + ((page - 1) * 50 + currentIndex + 1) + " of " + totalCount : "No cards yet"}</span>
              <span className="font-medium text-[#4e6b59]">{gotItCount} got it · {reviewCount} to review</span>
            </div>

            {loading ? (
              <section className="rounded-2xl border border-[#e3e9e1] bg-white p-7 text-center text-sm text-[#77877d]">Loading your practice cards…</section>
            ) : active ? (
              <section className="rounded-2xl border border-[#e3e9e1] bg-white p-3.5 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#edf5ee] px-3 py-1.5 text-xs font-semibold text-[#4f735c]">{active.category}</span>
                  <div className="flex gap-1">
                    <button type="button" aria-label="Previous card" onClick={() => move(-1)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#e2e9e1] text-lg text-[#62746a] hover:bg-[#f7faf7]">←</button>
                    <button type="button" aria-label="Next card" onClick={() => move(1)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#e2e9e1] text-lg text-[#62746a] hover:bg-[#f7faf7]">→</button>
                  </div>
                </div>
                <div className="min-h-28 rounded-xl bg-[#f5f8f3] px-3 py-5 sm:px-5">
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[.14em] text-[#859287]">Bangla</p>
                  <p lang="bn" className="text-center text-[23px] font-medium leading-[1.55] text-[#294c39] sm:text-[28px]">{active.bangla}</p>
                </div>

                {!revealed ? (
                  <div className="mt-3">
                    <p className="mb-2 text-center text-xs text-[#77877d]">Try the English translation in your head.</p>
                    <button type="button" onClick={() => setRevealed(true)} className="min-h-12 w-full rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white transition hover:bg-[#1f4934]">Show English</button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="rounded-xl border border-[#dce9dd] bg-[#f6fbf6] px-3 py-3.5">
                      <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-[.14em] text-[#78927d]">English</p>
                      <p className="text-center text-lg font-medium leading-7 text-[#294c39]">{active.english}</p>
                      {active.example && <p className="mt-3 border-t border-[#e2eee2] pt-3 text-center text-sm leading-6 text-[#738178]">{active.example}</p>}
                    </div>
                    {!rating ? (
                      <>
                        <p className="mb-2 mt-3 text-center text-xs text-[#77877d]">How did you do?</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button type="button" onClick={() => mark("got-it")} className="min-h-12 rounded-2xl bg-[#d8f0df] px-3 text-sm font-semibold text-[#285741] transition hover:bg-[#c9e9d3]">✓ Got it</button>
                          <button type="button" onClick={() => mark("review")} className="min-h-12 rounded-2xl bg-[#f5edda] px-3 text-sm font-semibold text-[#806733] transition hover:bg-[#f0e4c5]">↻ Review again</button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-3">
                        <p className="mb-2 text-center text-xs font-medium text-[#4e6b59]">{rating === "got-it" ? "Marked as got it." : "Added to your review count."}</p>
                        <button type="button" onClick={() => move(1)} className="min-h-12 w-full rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white transition hover:bg-[#1f4934]">Next {type === "sentence" ? "sentence" : "word"} →</button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-2xl border border-[#e3e9e1] bg-white px-4 py-8 text-center shadow-sm">
                <span className="text-3xl">✎</span>
                <h2 className="mt-3 text-lg font-semibold">No {type === "sentence" ? "sentences" : "words"} yet</h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#77877d]">{notice || "Add your first Bangla and English pair to start practicing."}</p>
                {isAdmin && <button type="button" onClick={() => setView("add")} className="mt-5 min-h-12 rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white">Add your first pair</button>}
              </section>
            )}
          </>
        )}

        {view === "practice" && totalCount > 0 && (
          <nav aria-label="Entry pages" className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#e3e9e1] bg-white px-2.5 py-2 sm:px-3">
            <button type="button" onClick={() => changePage(page - 1)} disabled={page <= 1 || loading} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#315d47] hover:bg-[#f4f8f3] disabled:cursor-not-allowed disabled:opacity-40">← Previous</button>
            <span className="text-center text-xs font-medium text-[#77877d] sm:text-sm">Page {page} of {totalPages}<span className="block text-[11px] font-normal">50 per page · {totalCount} total</span></span>
            <button type="button" onClick={() => changePage(page + 1)} disabled={page >= totalPages || loading} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#315d47] hover:bg-[#f4f8f3] disabled:cursor-not-allowed disabled:opacity-40">Next →</button>
          </nav>
        )}
        <footer className="mt-4 pb-1 text-center text-[10px] leading-4 text-[#97a197]">One small practice at a time.</footer>
      </div>
    </main>
  );
}





