"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import Image from "next/image";

type EntryType = "sentence" | "vocabulary";

type Rating = "got-it" | "review";

type DraftEntry = {
  type: EntryType;
  bangla: string;
  english: string;
  category: string;
  example?: string;
};

type Entry = {
  _id: string;

  type: EntryType;

  bangla: string;

  english: string;

  category: string;

  example?: string;
};

type LibraryPage = {
  entries: Entry[];
  categories: string[];
  total: number;
  totalPages: number;
};

type LibraryResult = { query: string } & (
  | { data: LibraryPage }
  | { error: true }
);

const pageSize = 50;

const defaultCategories = [
  "Daily life",
  "Daily conversation",
  "Work",
  "Travel",
  "Grammar",
  "Other",
];

export default function Home() {
  const [type, setType] = useState<EntryType>("sentence");

  const [view, setView] = useState<"practice" | "add" | "login">("practice");

  const [category, setCategory] = useState("All categories");

  const [categories, setCategories] = useState(defaultCategories);

  const [page, setPage] = useState(1);

  const [library, setLibrary] = useState<LibraryResult | null>(null);
  const [libraryRevision, setLibraryRevision] = useState(0);

  const [practiceMode, setPracticeMode] = useState<"card" | "browse">("card");
  const [cardIndex, setCardIndex] = useState(0);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const practiceTarget = useRef<HTMLElement>(null);
  const focusPractice = useRef(false);

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

  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<Entry | null>(null);

  const [updating, setUpdating] = useState(false);

  const [editError, setEditError] = useState("");

  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    bangla: "",
    english: "",
    category: "Daily life",
    example: "",
  });

  const [addingCategory, setAddingCategory] = useState(false);

  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([]);

  const params = new URLSearchParams({ type, page: String(page) });
  if (category !== "All categories") params.set("category", category);
  const libraryParams = params.toString();
  const libraryQuery = libraryRevision + ":" + libraryParams;
  const result = library?.query === libraryQuery ? library : null;
  const libraryPage = result && "data" in result ? result.data : null;
  const loadError = Boolean(result && "error" in result);
  const loading = !result;

  useEffect(() => {
    const controller = new AbortController();

    async function loadEntries() {
      try {
        const response = await fetch("/api/entries?" + libraryParams, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load practice cards.");
        const data: LibraryPage = await response.json();
        if (controller.signal.aborted) return;

        setLibrary({ query: libraryQuery, data });
        setCategories([...new Set([...defaultCategories, ...data.categories])].sort());
      } catch {
        if (!controller.signal.aborted) {
          setLibrary({ query: libraryQuery, error: true });
        }
      }
    }

    void loadEntries();
    return () => controller.abort();
  }, [libraryParams, libraryQuery]);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())

      .then((data) => {
        if (active) setIsAdmin(Boolean(data.isAdmin));
      })

      .catch(() => {
        if (active) setIsAdmin(false);
      })

      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("bhasha-progress") || "{}");
        setRatings(saved.ratings || {});
        setRatedEntries(saved.entries || {});
      } catch {
        /* Start with empty progress when storage is unavailable. */
      }
      setProgressReady(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!progressReady) return;

    try {
      localStorage.setItem(
        "bhasha-progress",
        JSON.stringify({ ratings, entries: ratedEntries }),
      );
    } catch {
      /* Practice remains available without storage. */
    }
  }, [ratings, ratedEntries, progressReady]);

  const matchingReviews = Object.values(ratedEntries).filter(
    (entry) =>
      entry.type === type &&
      ratings[entry._id] === "review" &&
      (category === "All categories" || entry.category === category),
  );

  const reviewPages = Math.max(1, Math.ceil(matchingReviews.length / pageSize));
  const displayPage = reviewOnly ? Math.min(reviewPage, reviewPages) : page;
  const displayPages = reviewOnly ? reviewPages : (libraryPage?.totalPages ?? 1);
  const displayTotal = reviewOnly ? matchingReviews.length : (libraryPage?.total ?? 0);
  const pageStart = (displayPage - 1) * pageSize;
  const displayedEntries = reviewOnly
    ? matchingReviews.slice(pageStart, pageStart + pageSize)
    : (libraryPage?.entries ?? []);

  const singleCard = practiceMode === "card";
  const cardOffset = Math.max(0, Math.min(cardIndex - pageStart, displayedEntries.length - 1));
  const activeEntry = displayedEntries[cardOffset];
  const cardNumber = pageStart + cardOffset + 1;
  const visibleEntries = singleCard && activeEntry ? [activeEntry] : displayedEntries;
  const practiceLoading = reviewOnly ? !progressReady : loading;
  const practiceError = !reviewOnly && loadError;

  useEffect(() => {
    if (focusPractice.current && !practiceLoading && practiceTarget.current) {
      practiceTarget.current.focus();
      focusPractice.current = false;
    }
  }, [activeEntry?._id, practiceComplete, practiceLoading, practiceError]);

  const gotItCount = Object.values(ratings).filter((item) => item === "got-it").length;
  const reviewCount = Object.values(ratings).filter((item) => item === "review").length;

  function moveToCard(index: number) {
    const nextPage = Math.floor(index / pageSize) + 1;
    if (reviewOnly) setReviewPage(nextPage);
    else setPage(nextPage);
    setCardIndex(index);
    setRevealed({});
    setPracticeComplete(false);
  }

  function navigateCard(index: number) {
    focusPractice.current = true;
    moveToCard(index);
  }

  function rateEntry(entry: Entry, rating: Rating) {
    setRatedEntries((current) => ({ ...current, [entry._id]: entry }));
    setRatings((current) => ({ ...current, [entry._id]: rating }));

    if (!singleCard) return;

    focusPractice.current = true;
    if (reviewOnly && rating === "got-it") {
      moveToCard(Math.max(0, Math.min(cardNumber - 1, displayTotal - 2)));
    } else if (cardNumber < displayTotal) {
      moveToCard(cardNumber);
    } else {
      setRevealed({});
      setPracticeComplete(true);
    }
  }

  function resetPractice() {
    focusPractice.current = false;
    setCardIndex(0);
    setReviewPage(1);
    setPage(1);
    setRevealed({});
    setPracticeComplete(false);
  }

  function updateType(value: EntryType) {
    if (value === type) return;
    setType(value);
    setCategory("All categories");
    setCategories(defaultCategories);
    resetPractice();
  }

  function updateCategory(value: string) {
    setCategory(value);
    resetPractice();
  }

  function updateReviewOnly(value: boolean) {
    if (value === reviewOnly) return;
    setReviewOnly(value);
    resetPractice();
  }

  function updatePracticeMode(value: "card" | "browse") {
    if (value === practiceMode) return;
    setPracticeMode(value);
    setRevealed({});
    setPracticeComplete(false);
  }

  function refreshLibrary() {
    setLibraryRevision((current) => current + 1);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing) return;

    setUpdating(true);

    setEditError("");

    try {
      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) setIsAdmin(false);

        throw new Error(data.error || "Could not save changes.");
      }

      const updated = data.entry as Entry;

      setLibrary((current) => {
        if (!current || !("data" in current)) return current;
        return {
          ...current,
          data: {
            ...current.data,
            entries: current.data.entries.map((entry) =>
              entry._id === updated._id ? updated : entry,
            ),
          },
        };
      });

      setRatedEntries((current) =>
        current[updated._id] ? { ...current, [updated._id]: updated } : current,
      );

      setCategories((current) =>
        [...new Set([...current, updated.category])].sort(),
      );

      setEditing(null);

      if (category !== "All categories" && category !== updated.category) {
        resetPractice();
        refreshLibrary();
      }

      setNotice("Changes saved.");
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Could not save changes.",
      );
    } finally {
      setUpdating(false);
    }
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

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;

    const addAnother = submitter?.value === "add-more";

    const savedCategory = form.category.trim();

    const hasBangla = Boolean(form.bangla.trim());

    const hasEnglish = Boolean(form.english.trim());

    const hasCurrentEntry = hasBangla && hasEnglish && Boolean(savedCategory);

    const hasPartialEntry =
      hasBangla || hasEnglish || Boolean(savedCategory && addingCategory);

    const current: DraftEntry = {
      type,

      bangla: form.bangla.trim(),

      english: form.english.trim(),

      category: savedCategory,

      ...(form.example.trim() ? { example: form.example.trim() } : {}),
    };

    if (addAnother) {
      if (draftEntries.length >= 99) {
        setNotice(
          "You can add up to 100 entries per batch. Save this batch to continue.",
        );

        return;
      }

      setDraftEntries((existing) => [...existing, current]);

      setCategories((existing) =>
        existing.includes(savedCategory)
          ? existing
          : [...existing, savedCategory].sort(),
      );

      setForm({
        bangla: "",
        english: "",
        category: savedCategory,
        example: "",
      });

      setAddingCategory(false);

      setNotice(
        `Added to the batch. ${draftEntries.length + 1} entr${draftEntries.length === 0 ? "y is" : "ies are"} waiting to be saved.`,
      );

      return;
    }

    if (draftEntries.length > 0 && hasPartialEntry && !hasCurrentEntry) {
      setNotice(
        "Finish the current pair or clear its fields before saving the queued entries.",
      );

      return;
    }

    if (draftEntries.length === 0 && !hasCurrentEntry) {
      setNotice("Enter both Bangla and English before saving.");
      return;
    }
    const batch =
      draftEntries.length > 0 && !hasCurrentEntry
        ? draftEntries
        : [...draftEntries, current];

    setSaving(true);

    setNotice("");

    try {
      const response = await fetch("/api/entries", {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ entries: batch }),
      });

      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Could not save this batch.");

      setCategory("All categories");
      setReviewOnly(false);
      resetPractice();
      refreshLibrary();

      setDraftEntries([]);

      setForm({ bangla: "", english: "", category: "Daily life", example: "" });

      setAddingCategory(false);

      setView("practice");

      setNotice(
        `Saved ${batch.length} ${batch.length === 1 ? "entry" : "entries"} to your library.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save this batch.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#edf5ef] via-[#f8faf7] to-[#e9f0ee] px-4 pb-12 pt-5 text-[#20362e] sm:px-6 sm:pt-9">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/bhasha-icon.svg"
              alt="Bhasha logo"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-2xl shadow-sm"
            />

            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight">
                Bhasha
              </p>
              <p className="text-xs text-[#77877d]">Bangla to English</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {authLoading ? (
              <span className="text-xs text-[#829087]">Checking…</span>
            ) : isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setView(view === "add" ? "practice" : "add");
                    setNotice("");
                  }}
                  className="min-h-11 rounded-xl border border-[#dce5dc] bg-white px-3 text-sm font-semibold text-[#315d47] shadow-sm hover:bg-[#f9fcf9] sm:px-4"
                >
                  {view === "add" ? "Practice" : "+ Add"}
                </button>

                <button
                  type="button"
                  onClick={logoutAdmin}
                  className="min-h-11 rounded-xl px-2 text-xs font-semibold text-[#718078] hover:bg-white sm:px-3"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setView(view === "login" ? "practice" : "login");
                  setNotice("");
                }}
                className="min-h-11 rounded-xl border border-[#dce5dc] bg-white px-3 text-sm font-semibold text-[#315d47] shadow-sm hover:bg-[#f9fcf9] sm:px-4"
              >
                {view === "login" ? "Cancel" : "Admin login"}
              </button>
            )}
          </div>
        </header>

        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-[#dfe9df] bg-[#e7eee7] p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => updateType("sentence")}
            aria-pressed={type === "sentence"}
            className={
              "min-h-12 rounded-xl px-3 text-sm font-semibold transition-all duration-200 " +
              (type === "sentence"
                ? "bg-white text-[#285741] shadow-sm"
                : "text-[#7a887e]")
            }
          >
            Sentences
          </button>

          <button
            type="button"
            onClick={() => updateType("vocabulary")}
            aria-pressed={type === "vocabulary"}
            className={
              "min-h-12 rounded-xl px-3 text-sm font-semibold transition-all duration-200 " +
              (type === "vocabulary"
                ? "bg-white text-[#285741] shadow-sm"
                : "text-[#7a887e]")
            }
          >
            Vocabulary
          </button>
        </div>

        {notice && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-[#dce8dc] bg-white px-4 py-3 text-sm leading-5 text-[#496454]"
          >
            {notice}
          </p>
        )}

        {view === "login" ? (
          <section className="rounded-3xl border border-[#e3e9e1] bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#829087]">
              Admin access
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Sign in to add entries
            </h1>

            <p className="mt-2 text-sm leading-5 text-[#7d8981]">
              Practice is open. Admin sign-in is only needed to add sentences or
              vocabulary.
            </p>

            <form onSubmit={loginAdmin} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">
                Admin email
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm({ ...loginForm, email: event.target.value })
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] px-4 text-base font-normal outline-none focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]"
                />
              </label>

              <label className="block text-sm font-semibold">
                Password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm({ ...loginForm, password: event.target.value })
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] px-4 text-base font-normal outline-none focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]"
                />
              </label>

              <button
                disabled={loggingIn}
                className="min-h-12 w-full rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white transition hover:bg-[#1f4934] disabled:opacity-60"
              >
                {loggingIn ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </section>
        ) : view === "add" && isAdmin ? (
          <section className="rounded-3xl border border-[#e3e9e1] bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#829087]">
              Your library
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Add {type === "sentence" ? "a sentence" : "a word"}
            </h1>

            <p className="mt-2 text-sm leading-5 text-[#7d8981]">
              Add pairs to a batch, then save them together.
            </p>

            <form onSubmit={addEntry} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">
                Bangla {type === "sentence" ? "sentence" : "word"}
                <textarea
                  required
                  lang="bn"
                  dir="auto"
                  value={form.bangla}
                  onChange={(event) =>
                    setForm({ ...form, bangla: event.target.value })
                  }
                  placeholder={
                    type === "sentence" ? "আজ আবহাওয়া সুন্দর।" : "সুন্দর"
                  }
                  className="mt-2 min-h-24 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] p-4 text-lg font-normal leading-7 outline-none placeholder:text-[#adb5ae] focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]"
                />
              </label>

              <label className="block text-sm font-semibold">
                English {type === "sentence" ? "translation" : "meaning"}
                <textarea
                  required
                  value={form.english}
                  onChange={(event) =>
                    setForm({ ...form, english: event.target.value })
                  }
                  placeholder={
                    type === "sentence"
                      ? "The weather is beautiful today."
                      : "beautiful"
                  }
                  className="mt-2 min-h-24 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] p-4 text-base font-normal leading-6 outline-none placeholder:text-[#adb5ae] focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]"
                />
              </label>

              {type === "vocabulary" && (
                <label className="block text-sm font-semibold">
                  Example (optional)
                  <input
                    value={form.example}
                    onChange={(event) =>
                      setForm({ ...form, example: event.target.value })
                    }
                    placeholder="The garden is beautiful."
                    className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] px-4 text-base font-normal outline-none placeholder:text-[#adb5ae] focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]"
                  />
                </label>
              )}

              <label className="block text-sm font-semibold">
                Category
                <select
                  value={
                    addingCategory ? "__add_new_category__" : form.category
                  }
                  onChange={(event) => {
                    if (event.target.value === "__add_new_category__") {
                      setAddingCategory(true);

                      setForm({ ...form, category: "" });
                    } else {
                      setAddingCategory(false);

                      setForm({ ...form, category: event.target.value });
                    }
                  }}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-white px-4 text-base font-normal outline-none focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}

                  <option value="__add_new_category__">
                    + Add new category…
                  </option>
                </select>
              </label>

              {addingCategory && (
                <label className="block text-sm font-semibold">
                  New category name
                  <input
                    required
                    autoFocus
                    maxLength={60}
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                    placeholder="For example, Daily conversation"
                    className="mt-2 min-h-12 w-full rounded-2xl border border-[#dfe6de] bg-[#fbfcfa] px-4 text-base font-normal outline-none focus:border-[#76ad8c] focus:ring-2 focus:ring-[#d7f0df]"
                  />
                </label>
              )}

              <button
                type="submit"
                value="add-more"
                disabled={saving}
                className="min-h-12 w-full rounded-2xl border border-[#b8d1be] bg-white px-3 text-sm font-semibold text-[#285741] transition hover:bg-[#f4f8f3] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Add more"}
              </button>

              {draftEntries.length > 0 && (
                <section
                  aria-label="Entries waiting to be saved"
                  className="rounded-xl border border-[#dce8dc] bg-[#f7faf6] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[#315d47]">
                      Ready to save
                    </h2>
                    <span className="text-xs text-[#77877d]">
                      {draftEntries.length} queued · not saved yet
                    </span>
                  </div>

                  <ol className="max-h-52 space-y-2 overflow-y-auto">
                    {draftEntries.map((entry, index) => (
                      <li
                        key={`${index}-${entry.type}`}
                        className="flex items-start gap-2 rounded-lg bg-white p-2 text-xs"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-medium text-[#294c39]">
                            {entry.bangla}
                          </span>
                          <span className="mt-0.5 block break-words text-[#77877d]">
                            {entry.english}
                          </span>
                          <span className="mt-1 inline-block rounded bg-[#edf5ee] px-1.5 py-0.5 text-[10px] text-[#496454]">
                            {entry.category} · {entry.type}
                          </span>
                        </span>

                        <button
                          type="button"
                          aria-label={`Remove queued entry ${index + 1}`}
                          onClick={() =>
                            setDraftEntries((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          className="min-h-8 shrink-0 rounded px-2 font-semibold text-[#718078] hover:bg-[#f4f8f3]"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <button
                type="submit"
                value="save"
                formNoValidate={draftEntries.length > 0}
                disabled={saving}
                className="min-h-12 w-full rounded-2xl bg-[#285741] px-3 text-sm font-semibold text-white transition hover:bg-[#1f4934] disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : draftEntries.length > 0
                    ? `Save all (${draftEntries.length + (form.bangla.trim() && form.english.trim() && form.category.trim() ? 1 : 0)})`
                    : "Save pair"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {singleCard ? (type === "sentence" ? "Translate into English" : "Recall the meaning") : (type === "sentence" ? "Browse sentences" : "Browse vocabulary")}
              </h1>
              <div role="group" aria-label="Practice view" className="flex rounded-xl border border-[#dfe6de] bg-white p-1">
                <button
                  type="button"
                  aria-pressed={singleCard}
                  onClick={() => updatePracticeMode("card")}
                  className={singleCard ? "min-h-10 rounded-lg bg-[#285741] px-3 text-sm font-semibold text-white" : "min-h-10 rounded-lg px-3 text-sm font-semibold text-[#315d47] hover:bg-[#edf5ee]"}
                >
                  Practice
                </button>
                <button
                  type="button"
                  aria-pressed={!singleCard}
                  onClick={() => updatePracticeMode("browse")}
                  className={!singleCard ? "min-h-10 rounded-lg bg-[#285741] px-3 text-sm font-semibold text-white" : "min-h-10 rounded-lg px-3 text-sm font-semibold text-[#315d47] hover:bg-[#edf5ee]"}
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by category"
                value={category}
                onChange={(event) => updateCategory(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#dfe6de] bg-white px-3 text-sm focus-visible:outline-[#285741] sm:mr-auto sm:w-auto sm:max-w-[50%]"
              >
                <option>All categories</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <div role="group" aria-label="Card selection" className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={!reviewOnly}
                  onClick={() => updateReviewOnly(false)}
                  className={"min-h-11 rounded-xl border px-3 text-sm font-semibold " + (!reviewOnly ? "border-[#285741] bg-[#d8f0df]" : "border-[#e3e9e1] bg-white")}
                >
                  All cards
                </button>
                <button
                  type="button"
                  aria-pressed={reviewOnly}
                  onClick={() => updateReviewOnly(true)}
                  className={"min-h-11 rounded-xl border px-3 text-sm font-semibold " + (reviewOnly ? "border-[#806733] bg-[#f5edda]" : "border-[#e3e9e1] bg-white")}
                >
                  Review queue ({matchingReviews.length})
                </button>
              </div>
            </div>

            {practiceLoading ? (
              <p role="status" className="rounded-2xl border border-[#e3e9e1] bg-white p-7 text-center text-sm text-[#496454]">
                Loading practice cards…
              </p>
            ) : practiceError ? (
              <section
                ref={practiceTarget}
                tabIndex={-1}
                className="rounded-2xl border border-[#e3e9e1] bg-white p-7 text-center shadow-sm"
              >
                <h2 className="text-lg font-semibold">Couldn’t load practice cards</h2>
                <p className="mt-2 text-sm text-[#496454]">Try loading this selection again.</p>
                <button
                  type="button"
                  onClick={() => {
                    focusPractice.current = true;
                    refreshLibrary();
                  }}
                  className="mt-4 min-h-11 rounded-xl bg-[#285741] px-4 text-sm font-semibold text-white"
                >
                  Retry
                </button>
              </section>
            ) : singleCard && practiceComplete ? (
              <section
                ref={practiceTarget}
                tabIndex={-1}
                className="rounded-2xl border border-[#e3e9e1] bg-white p-7 text-center shadow-sm"
              >
                <h2 className="text-xl font-semibold">You reached the last card</h2>
                <button
                  type="button"
                  onClick={() => navigateCard(0)}
                  className="mt-4 min-h-11 rounded-xl bg-[#285741] px-4 text-sm font-semibold text-white"
                >
                  Start over
                </button>
              </section>
            ) : visibleEntries.length > 0 ? (
              <>
                <p
                  ref={!singleCard ? (node) => { practiceTarget.current = node; } : undefined}
                  tabIndex={!singleCard ? -1 : undefined}
                  className="mb-3 text-sm font-medium text-[#496454]"
                  role="status"
                >
                  {singleCard
                    ? `Card ${cardNumber} of ${displayTotal}`
                    : `Showing ${pageStart + 1}–${pageStart + displayedEntries.length} of ${displayTotal}`}
                  {progressReady && ` · ${gotItCount} got it · ${reviewCount} to review`}
                </p>
                <ol className="grid gap-3" start={singleCard ? cardNumber : pageStart + 1}>
                  {visibleEntries.map((entry, index) => (
                    <li
                      key={entry._id}
                      className={"rounded-2xl border border-[#e2eae1] bg-white shadow-sm " + (singleCard ? "p-5 sm:p-7" : "p-4 sm:p-5")}
                    >
                      <div className={singleCard ? "flex flex-col items-start gap-4" : "flex items-start gap-2"}>
                        {!singleCard && (
                          <span className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#edf5ee] px-1 text-xs font-semibold text-[#47745b]">
                            {pageStart + index + 1}.
                          </span>
                        )}

                        <p
                          ref={singleCard ? (node) => { practiceTarget.current = node; } : undefined}
                          tabIndex={singleCard ? -1 : undefined}
                          lang="bn"
                          className={"min-w-0 wrap-break-word font-medium text-[#294c39] " + (singleCard ? "w-full text-2xl leading-relaxed sm:text-3xl" : "flex-1 py-1 text-lg leading-8")}
                        >
                          {entry.bangla}
                        </p>

                        <button
                          type="button"
                          aria-expanded={Boolean(revealed[entry._id])}
                          aria-controls={"english-" + entry._id}
                          onClick={() =>
                            setRevealed((current) => ({
                              ...current,
                              [entry._id]: !current[entry._id],
                            }))
                          }
                          className={singleCard && !revealed[entry._id]
                            ? "min-h-11 w-full rounded-xl bg-[#285741] px-4 text-sm font-semibold text-white hover:bg-[#1f4934] sm:w-auto"
                            : "min-h-11 shrink-0 rounded-xl border border-[#cfe3d2] bg-[#f0f8f0] px-3 text-sm font-semibold text-[#285741] hover:bg-[#dff1e3]"}
                        >
                          {revealed[entry._id] ? "Hide English" : "Reveal English"}
                        </button>
                      </div>

                      <div id={"english-" + entry._id} hidden={!revealed[entry._id]}>
                        {revealed[entry._id] && (
                          <div className={"mt-3 rounded-xl border border-[#e3eee4] bg-[#f7fbf7] p-4 " + (singleCard ? "" : "sm:ml-9")}>
                            <p className="wrap-break-word text-base font-semibold leading-7 text-[#214c35]">
                              {entry.english}
                            </p>

                            {entry.example && (
                              <p className="mt-1 text-sm text-[#77877d]">
                                {entry.example}
                              </p>
                            )}

                            <div className="mt-1.5 flex flex-wrap gap-2">
                              <button
                                type="button"
                                aria-pressed={ratings[entry._id] === "got-it"}
                                onClick={() => rateEntry(entry, "got-it")}
                                className={
                                  "min-h-11 rounded-lg border px-3 text-sm font-semibold " +
                                  (ratings[entry._id] === "got-it"
                                    ? "border-[#285741] bg-[#d8f0df]"
                                    : "border-[#e3e9e1]")
                                }
                              >
                                Got it
                              </button>

                              <button
                                type="button"
                                aria-pressed={ratings[entry._id] === "review"}
                                onClick={() => rateEntry(entry, "review")}
                                className={
                                  "min-h-11 rounded-lg border px-3 text-sm font-semibold " +
                                  (ratings[entry._id] === "review"
                                    ? "border-[#806733] bg-[#f5edda]"
                                    : "border-[#e3e9e1]")
                                }
                              >
                                Review again
                              </button>

                              {isAdmin && (
                                <button
                                  type="button"
                                  disabled={updating}
                                  aria-label="Edit entry"
                                  onClick={() => {
                                    setEditing({ ...entry });
                                    setEditError("");
                                  }}
                                  className="ml-auto min-h-8 shrink-0 rounded-md px-2 text-xs font-semibold text-[#718078] hover:bg-[#edf5ee]"
                                >
                                  Edit
                                </button>
                              )}
                            </div>

                            {isAdmin && editing?._id === entry._id && (
                              <form
                                onSubmit={saveEdit}
                                className="my-2 space-y-2 rounded-lg border border-[#dce5dc] bg-[#f6f8f4] p-3"
                              >
                                <label className="block text-xs font-semibold">
                                  Bangla
                                  <textarea
                                    required
                                    autoFocus
                                    lang="bn"
                                    value={editing.bangla}
                                    onChange={(event) =>
                                      setEditing({
                                        ...editing,
                                        bangla: event.target.value,
                                      })
                                    }
                                    className="mt-1 min-h-20 w-full rounded-lg border border-[#dce5dc] bg-white p-2 text-base font-normal"
                                  />
                                </label>

                                <label className="block text-xs font-semibold">
                                  English
                                  <textarea
                                    required
                                    value={editing.english}
                                    onChange={(event) =>
                                      setEditing({
                                        ...editing,
                                        english: event.target.value,
                                      })
                                    }
                                    className="mt-1 min-h-20 w-full rounded-lg border border-[#dce5dc] bg-white p-2 text-base font-normal"
                                  />
                                </label>

                                <label className="block text-xs font-semibold">
                                  Category
                                  <input
                                    required
                                    list="edit-categories"
                                    value={editing.category}
                                    onChange={(event) =>
                                      setEditing({
                                        ...editing,
                                        category: event.target.value,
                                      })
                                    }
                                    className="mt-1 min-h-10 w-full rounded-lg border border-[#dce5dc] bg-white px-2 text-base font-normal"
                                  />
                                  <datalist id="edit-categories">
                                    {categories.map((item) => (
                                      <option key={item} value={item} />
                                    ))}
                                  </datalist>
                                </label>

                                {entry.type === "vocabulary" && (
                                  <label className="block text-xs font-semibold">
                                    Example
                                    <input
                                      value={editing.example || ""}
                                      onChange={(event) =>
                                        setEditing({
                                          ...editing,
                                          example: event.target.value,
                                        })
                                      }
                                      className="mt-1 min-h-10 w-full rounded-lg border border-[#dce5dc] bg-white px-2 text-base font-normal"
                                    />
                                  </label>
                                )}

                                {editError && (
                                  <p role="alert" className="text-xs text-red-700">
                                    {editError}
                                  </p>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    disabled={updating}
                                    className="min-h-10 rounded-lg bg-[#285741] px-3 text-xs font-semibold text-white disabled:opacity-50"
                                  >
                                    {updating ? "Saving…" : "Save changes"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={updating}
                                    onClick={() => setEditing(null)}
                                    className="min-h-10 rounded-lg border border-[#dce5dc] px-3 text-xs font-semibold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <section ref={practiceTarget} tabIndex={-1} className="rounded-2xl border border-[#e3e9e1] bg-white px-4 py-8 text-center shadow-sm">
                <h2 className="text-lg font-semibold">
                  {reviewOnly
                    ? "Nothing to review"
                    : category !== "All categories"
                      ? "No cards in this category"
                      : type === "sentence"
                        ? "No sentence cards yet"
                        : "No vocabulary cards yet"}
                </h2>
                {reviewOnly && (
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#496454]">
                    Choose Review again on a card to add it to this queue.
                  </p>
                )}
                {!reviewOnly && category !== "All categories" && (
                  <button
                    type="button"
                    onClick={() => updateCategory("All categories")}
                    className="mt-4 min-h-11 rounded-xl border border-[#cfe3d2] px-4 text-sm font-semibold text-[#285741]"
                  >
                    Clear category filter
                  </button>
                )}

                {isAdmin && !reviewOnly && category === "All categories" && (
                  <button
                    type="button"
                    onClick={() => setView("add")}
                    className="mt-5 min-h-12 rounded-2xl bg-[#285741] px-5 text-sm font-semibold text-white"
                  >
                    Add your first pair
                  </button>
                )}
              </section>
            )}
          </>
        )}

        {view === "practice" && !practiceLoading && !practiceError && !practiceComplete && visibleEntries.length > 0 && (singleCard ? displayTotal > 1 : displayPages > 1) && (
          <nav
            aria-label={singleCard ? "Practice cards" : "Entry pages"}
            className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#e3e9e1] bg-white px-2.5 py-2 sm:px-3"
          >
            <button
              type="button"
              onClick={() => navigateCard(singleCard ? cardNumber - 2 : pageStart - pageSize)}
              disabled={singleCard ? cardNumber <= 1 : displayPage <= 1}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[#315d47] hover:bg-[#f4f8f3] disabled:opacity-40"
            >
              Previous
            </button>

            {!singleCard && (
              <span className="text-center text-sm font-medium text-[#496454]">
                Page {displayPage} of {displayPages}
              </span>
            )}

            <button
              type="button"
              onClick={() => navigateCard(singleCard ? cardNumber : pageStart + pageSize)}
              disabled={singleCard ? cardNumber >= displayTotal : displayPage >= displayPages}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[#315d47] hover:bg-[#f4f8f3] disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        )}

        <footer className="mt-8 pb-1 text-center text-xs leading-5 text-[#7c9084]">
          One small practice at a time.
        </footer>
      </div>
    </main>
  );
}
