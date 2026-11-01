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

const defaultCategories = ["Daily life", "Conversation", "Work", "Travel", "Grammar", "Other"];

export default function Home() {
  const [type, setType] = useState<EntryType>("sentence");
  const [view, setView] = useState<"practice" | "add" | "login">("practice");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [category, setCategory] = useState("All categories");
  const [categories, setCategories] = useState(defaultCategories);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [reviewOnly, setReviewOnly] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [ratedEntries, setRatedEntries] = useState<Record<string, Entry>>({});
  const [progressReady, setProgressReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loggingIn, setLoggingIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ bangla: "", english: "", category: "Daily life", example: "" });

  async function loadEntries(selected: EntryType, requestedPage = 1, selectedCategory = "All categories") {
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
      if (Array.isArray(data.categories)) {
        setCategories([...new Set([...defaultCategories, ...data.categories.filter((value: unknown): value is string => typeof value === "string")])].sort());
      }
      setPage(data.page);
      setTotalCount(data.total);
      setTotalPages(data.totalPages);
      setRevealed({});
    } catch (error) {
      setEntries([]);
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
    setReviewPage(1);
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
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bhasha-progress") || "{}");
      setRatings(saved.ratings || {});
      setRatedEntries(saved.entries || {});
    } catch { /* Start with empty progress when storage is unavailable. */ }
    setProgressReady(true);
  }, []);

  useEffect(() => {
    if (!progressReady) return;
    try { localStorage.setItem("bhasha-progress", JSON.stringify({ ratings, entries: ratedEntries })); } catch { /* Practice remains available without storage. */ }
  }, [ratings, ratedEntries, progressReady]);

  const matchingReviews = Object.values(ratedEntries).filter((entry) => entry.type === type && ratings[entry._id] === "review" && (category === "All categories" || entry.category === category));
  const reviewPages = Math.max(1, Math.ceil(matchingReviews.length / 50));
  const displayPage = reviewOnly ? Math.min(reviewPage, reviewPages) : page;
  const displayPages = reviewOnly ? reviewPages : totalPages;
  const displayTotal = reviewOnly ? matchingReviews.length : totalCount;
  const displayedEntries = reviewOnly ? matchingReviews.slice((displayPage - 1) * 50, displayPage * 50) : entries;
  function rateEntry(entry: Entry, rating: Rating) {
    setRatedEntries((current) => ({ ...current, [entry._id]: entry }));
    setRatings((current) => ({ ...current, [entry._id]: rating }));
  }

  const gotItCount = Object.values(ratings).filter((item) => item === "got-it").length;
  const reviewCount = Object.values(ratings).filter((item) => item === "review").length;

  function changePage(nextPage: number) {
    if (reviewOnly) { setReviewPage(Math.max(1, Math.min(nextPage, reviewPages))); setRevealed({}); return; }
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    void loadEntries(type, nextPage, category);
  }

  function updateCategory(value: string) {
    setCategory(value);
    setReviewPage(1);
    setPage(1);
    void loadEntries(type, 1, value);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setUpdating(true);
    setEditError("");
    try {
      const response = await fetch("/api/entries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setIsAdmin(false);
        throw new Error(data.error || "Could not save changes.");
      }
      const updated = data.entry as Entry;
      setEntries((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
      setRatedEntries((current) => current[updated._id] ? { ...current, [updated._id]: updated } : current);
      setCategories((current) => [...new Set([...current, updated.category])].sort());
      setEditing(null);
      if (category !== "All categories" && category !== updated.category) await loadEntries(type, 1, category);
      setNotice("Changes saved.");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not save changes.");
    } finally { setUpdating(false); }
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

            <div className="mb-2 flex gap-2">
              <button type="button" aria-pressed={!reviewOnly} onClick={() => { setReviewOnly(false); setRevealed({}); }} className={"min-h-9 rounded-lg border px-3 text-xs font-semibold " + (!reviewOnly ? "border-[#285741] bg-[#d8f0df]" : "border-[#e3e9e1] bg-white")}>All</button>
              <button type="button" aria-pressed={reviewOnly} onClick={() => { setReviewOnly(true); setReviewPage(1); setRevealed({}); }} className={"min-h-9 rounded-lg border px-3 text-xs font-semibold " + (reviewOnly ? "border-[#806733] bg-[#f5edda]" : "border-[#e3e9e1] bg-white")}>↻ Review again ({matchingReviews.length})</button>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-xl border border-[#e3e9e1] bg-white px-3 py-2.5 text-xs">
              <span className="text-[#77877d]">{(loading && !reviewOnly) ? "Loading…" : displayedEntries.length ? "Showing " + ((displayPage - 1) * 50 + 1) + "–" + ((displayPage - 1) * 50 + displayedEntries.length) + " of " + displayTotal : "No cards yet"}</span>
              <span className="font-medium text-[#4e6b59]">{gotItCount} got it · {reviewCount} to review</span>
            </div>

            {(loading && !reviewOnly) ? (
              <section className="rounded-2xl border border-[#e3e9e1] bg-white p-7 text-center text-sm text-[#77877d]">Loading your practice cards…</section>
            ) : displayedEntries.length > 0 ? (
              <ol className="divide-y divide-[#e3e9e1] overflow-hidden rounded-xl border border-[#e3e9e1] bg-white" start={(displayPage - 1) * 50 + 1}>
                {displayedEntries.map((entry, index) => (
                  <li key={entry._id} className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="pt-1 text-[11px] leading-6 text-[#829087]">{(displayPage - 1) * 50 + index + 1}.</span>
                      <p lang="bn" className="min-w-0 flex-1 break-words py-1 text-base leading-6 text-[#294c39]">{entry.bangla}</p>
                      <button type="button" aria-expanded={Boolean(revealed[entry._id])} aria-label={revealed[entry._id] ? "Hide English translation" : "Show English translation"} onClick={() => setRevealed((current) => ({ ...current, [entry._id]: !current[entry._id] }))} className="min-h-9 shrink-0 rounded-md px-2 text-xs font-semibold text-[#285741] hover:bg-[#edf5ee]">
                        {revealed[entry._id] ? "Hide" : "English"}
                      </button>
                    </div>
                    {revealed[entry._id] && (
                      <div className="ml-5 border-t border-[#edf1eb] pt-2 pb-1">
                        <p className="break-words text-sm leading-5">{entry.english}</p>
                        {entry.example && <p className="mt-1 text-sm text-[#77877d]">{entry.example}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button type="button" aria-pressed={ratings[entry._id] === "got-it"} onClick={() => rateEntry(entry, "got-it")} className={"min-h-8 rounded-md border px-2 text-xs font-semibold " + (ratings[entry._id] === "got-it" ? "border-[#285741] bg-[#d8f0df]" : "border-[#e3e9e1]")}>✓ Got it</button>
                          <button type="button" aria-pressed={ratings[entry._id] === "review"} onClick={() => rateEntry(entry, "review")} className={"min-h-8 rounded-md border px-2 text-xs font-semibold " + (ratings[entry._id] === "review" ? "border-[#806733] bg-[#f5edda]" : "border-[#e3e9e1]")}>↻ Review again</button>
                      {isAdmin && <button type="button" disabled={updating} aria-label="Edit entry" onClick={() => { setEditing({ ...entry }); setEditError(""); }} className="ml-auto min-h-8 shrink-0 rounded-md px-2 text-xs font-semibold text-[#718078] hover:bg-[#edf5ee]">Edit</button>}
                        </div>
                    {isAdmin && editing?._id === entry._id && (
                      <form onSubmit={saveEdit} className="my-2 space-y-2 rounded-lg border border-[#dce5dc] bg-[#f6f8f4] p-3">
                        <label className="block text-xs font-semibold">Bangla
                          <textarea required autoFocus lang="bn" value={editing.bangla} onChange={(event) => setEditing({ ...editing, bangla: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-[#dce5dc] bg-white p-2 text-base font-normal" />
                        </label>
                        <label className="block text-xs font-semibold">English
                          <textarea required value={editing.english} onChange={(event) => setEditing({ ...editing, english: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-[#dce5dc] bg-white p-2 text-base font-normal" />
                        </label>
                        <label className="block text-xs font-semibold">Category
                          <input required list="edit-categories" value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-[#dce5dc] bg-white px-2 text-base font-normal" />
                          <datalist id="edit-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
                        </label>
                        {entry.type === "vocabulary" && <label className="block text-xs font-semibold">Example
                          <input value={editing.example || ""} onChange={(event) => setEditing({ ...editing, example: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-[#dce5dc] bg-white px-2 text-base font-normal" />
                        </label>}
                        {editError && <p role="alert" className="text-xs text-red-700">{editError}</p>}
                        <div className="flex gap-2">
                          <button disabled={updating} className="min-h-10 rounded-lg bg-[#285741] px-3 text-xs font-semibold text-white disabled:opacity-50">{updating ? "Saving…" : "Save changes"}</button>
                          <button type="button" disabled={updating} onClick={() => setEditing(null)} className="min-h-10 rounded-lg border border-[#dce5dc] px-3 text-xs font-semibold">Cancel</button>
                        </div>
                      </form>
                    )}

                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <section className="rounded-2xl border border-[#e3e9e1] bg-white px-4 py-8 text-center shadow-sm">
                <span className="text-3xl">✎</span>
                <h2 className="mt-3 text-lg font-semibold">{reviewOnly ? "Nothing to review" : "No entries yet"}</h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#77877d]">{reviewOnly ? "Mark an entry as Review again to find it here. Mark it Got it when you remember it." : notice || "Add your first Bangla and English pair to start practicing."}</p>
                {isAdmin && !reviewOnly && <button type="button" onClick={() => setView("add")} className="mt-5 min-h-12 rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white">Add your first pair</button>}
              </section>
            )}
          </>
        )}

        {view === "practice" && displayTotal > 0 && (
          <nav aria-label="Entry pages" className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#e3e9e1] bg-white px-2.5 py-2 sm:px-3">
            <button type="button" onClick={() => changePage(displayPage - 1)} disabled={displayPage <= 1 || (loading && !reviewOnly)} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#315d47] hover:bg-[#f4f8f3] disabled:cursor-not-allowed disabled:opacity-40">← Previous</button>
            <span className="text-center text-xs font-medium text-[#77877d] sm:text-sm">Page {displayPage} of {displayPages}<span className="block text-[11px] font-normal">50 per page · {displayTotal} total</span></span>
            <button type="button" onClick={() => changePage(displayPage + 1)} disabled={displayPage >= displayPages || (loading && !reviewOnly)} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#315d47] hover:bg-[#f4f8f3] disabled:cursor-not-allowed disabled:opacity-40">Next →</button>
          </nav>
        )}
        <footer className="mt-4 pb-1 text-center text-[10px] leading-4 text-[#97a197]">One small practice at a time.</footer>
      </div>
    </main>
  );
}





