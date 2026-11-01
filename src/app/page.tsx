"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entry = {
  _id: string;
  type: "sentence" | "vocabulary";
  bangla: string;
  english: string;
  category: string;
  example?: string;
};

const categories = ["Daily life", "Conversation", "Work", "Travel", "Grammar", "Other"];

export default function Home() {
  const [type, setType] = useState<"sentence" | "vocabulary">("sentence");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<Entry | null>(null);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("All categories");
  const [form, setForm] = useState({ bangla: "", english: "", category: "Daily life", example: "" });

  async function loadEntries(selected = type) {
    setLoading(true);
    try {
      const response = await fetch("/api/entries?type=" + selected, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your entries.");
      setEntries(data.entries);
      setActive(data.entries[0] || null);
      setAnswer("");
      setRevealed(false);
      setNotice("");
    } catch (error) {
      setEntries([]);
      setActive(null);
      setNotice(error instanceof Error ? error.message : "Could not connect to MongoDB.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEntries(type); }, [type]);

  const filtered = useMemo(
    () => category === "All categories" ? entries : entries.filter((entry) => entry.category === category),
    [category, entries],
  );
  const currentIndex = active ? filtered.findIndex((entry) => entry._id === active._id) : -1;

  function choose(entry: Entry) {
    setActive(entry);
    setAnswer("");
    setRevealed(false);
  }

  function nextEntry() {
    if (!filtered.length) return;
    choose(filtered[(Math.max(currentIndex, -1) + 1) % filtered.length]);
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
      setEntries((current) => [data.entry, ...current]);
      setActive(data.entry);
      setAnswer("");
      setRevealed(false);
      setForm({ bangla: "", english: "", category: "Daily life", example: "" });
      setNotice("Saved to your library.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f5f0] text-[#202b27]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-[238px] shrink-0 flex-col border-r border-[#e7e8e1] bg-[#fbfbf8] px-5 py-7 lg:flex">
          <a className="mb-12 flex items-center gap-3" href="#">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#c6e9d7] text-xl">অ</span>
            <span><b className="block text-[15px] tracking-tight">Bhasha</b><small className="text-xs text-[#7b8780]">Bangla → English</small></span>
          </a>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#9ba49d]">Learn</p>
          <button onClick={() => setType("sentence")} className={"nav-item " + (type === "sentence" ? "nav-active" : "")}><span>▤</span> Sentences</button>
          <button onClick={() => setType("vocabulary")} className={"nav-item " + (type === "vocabulary" ? "nav-active" : "")}><span>◈</span> Vocabulary</button>
          <div className="mt-auto rounded-2xl bg-[#edf4ee] p-4">
            <span className="text-lg">✦</span>
            <p className="mt-2 text-sm font-semibold">A little each day</p>
            <p className="mt-1 text-xs leading-5 text-[#738178]">Try a few translations, then come back tomorrow.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-9">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#89958c]">Your learning space</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[34px]">Practice room</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#e7e8e1] bg-white px-4 py-2 text-sm text-[#68756d]">
              <span className="h-2 w-2 rounded-full bg-[#63b58a]" /> Personal library
            </div>
          </header>

          <div className="mb-6 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="rounded-3xl bg-[#244c3d] p-6 text-white sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b8d9c7]">Today’s practice</p>
              <h2 className="mt-3 max-w-md text-2xl font-semibold leading-tight">Think in Bangla.<br />Find your English.</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[#d1e2d7]">Try translating first. Reveal the answer when you’re ready.</p>
              <div className="mt-6 flex gap-2">
                <button onClick={nextEntry} disabled={!filtered.length} className="rounded-xl bg-[#d2f0dd] px-4 py-2.5 text-sm font-semibold text-[#204635] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">Start practicing <span className="ml-1">→</span></button>
              </div>
            </div>
            <div className="rounded-3xl border border-[#e9e9e2] bg-white p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a958d]">In this set</p>
              <p className="mt-5 text-4xl font-semibold tracking-tight">{entries.length.toString().padStart(2, "0")}</p>
              <p className="mt-2 text-sm text-[#79847d]">{type === "sentence" ? "sentence pairs" : "vocabulary words"}</p>
            </div>
            <div className="rounded-3xl border border-[#e9e9e2] bg-white p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a958d]">Your focus</p>
              <p className="mt-5 text-2xl font-semibold">{type === "sentence" ? "Sentences" : "Vocabulary"}</p>
              <p className="mt-2 text-sm text-[#79847d]">Choose a prompt and take your time.</p>
            </div>
          </div>

          <div className="mb-5 flex gap-2 lg:hidden">
            <button onClick={() => setType("sentence")} className={"rounded-full px-4 py-2 text-sm " + (type === "sentence" ? "bg-[#244c3d] text-white" : "border bg-white")}>Sentences</button>
            <button onClick={() => setType("vocabulary")} className={"rounded-full px-4 py-2 text-sm " + (type === "vocabulary" ? "bg-[#244c3d] text-white" : "border bg-white")}>Vocabulary</button>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(310px,.75fr)]">
            <div className="rounded-3xl border border-[#e9e9e2] bg-white p-5 sm:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8a958d]">Translation practice</p><h2 className="mt-1 text-xl font-semibold">{type === "sentence" ? "Translate this sentence" : "Recall this word"}</h2></div>
                <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-[#e7e9e2] bg-[#fbfbf8] px-3 py-2 text-sm outline-none focus:border-[#68ad89]">
                  <option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              {notice && <p role="status" className="mb-4 rounded-xl bg-[#f0f5ef] px-4 py-3 text-sm text-[#496454]">{notice}</p>}
              {loading ? <div className="py-14 text-center text-sm text-[#87928a]">Loading your library…</div> : active ? (
                <>
                  <div className="rounded-2xl bg-[#f7f8f3] px-5 py-7 sm:px-7">
                    <div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-[#e2efe5] px-3 py-1 text-xs font-medium text-[#527160]">{active.category}</span><span className="text-xs text-[#98a198]">{Math.max(currentIndex + 1, 1)} / {filtered.length}</span></div>
                    <p lang="bn" className="text-right text-[26px] font-medium leading-[1.7] text-[#263f34] sm:text-[30px]">{active.bangla}</p>
                  </div>
                  {type === "sentence" && <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write your English translation here…" className="mt-4 min-h-24 w-full resize-y rounded-2xl border border-[#e8e9e3] bg-white p-4 text-sm outline-none placeholder:text-[#a4aaa3] focus:border-[#68ad89]" />}
                  {revealed && <div className="mt-4 rounded-2xl border border-[#d5eadb] bg-[#f3faf5] p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d9278]">English answer</p><p className="mt-2 text-lg font-medium leading-7 text-[#244c3d]">{active.english}</p>{active.example && <p className="mt-3 border-t border-[#e0eee3] pt-3 text-sm text-[#718078]">Example: {active.example}</p>}</div>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => setRevealed(true)} className="rounded-xl bg-[#244c3d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#183c2e]">{revealed ? "Answer revealed" : "Show English answer"}</button>
                    <button onClick={nextEntry} className="rounded-xl border border-[#e7e9e2] px-4 py-2.5 text-sm font-semibold text-[#4d5d53] hover:bg-[#f8f9f6]">Next prompt →</button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl bg-[#f7f8f3] px-5 py-12 text-center">
                  <p className="text-3xl">✎</p><h3 className="mt-3 font-semibold">Your practice set is ready for your sentences</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7c8880]">{notice || "Add your first Bangla–English pair using the form, then it will appear here for practice."}</p>
                </div>
              )}
            </div>

            <form onSubmit={addEntry} className="rounded-3xl border border-[#e9e9e2] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8a958d]">Build your library</p><h2 className="mt-1 text-xl font-semibold">Add {type === "sentence" ? "a sentence" : "a word"}</h2></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf4ee] text-lg text-[#527160]">＋</span></div>
              <label className="mb-2 block text-sm font-medium">Bangla {type === "sentence" ? "sentence" : "word"}<textarea required lang="bn" dir="auto" value={form.bangla} onChange={(event) => setForm({ ...form, bangla: event.target.value })} placeholder={type === "sentence" ? "আজ আবহাওয়া সুন্দর।" : "সুন্দর"} className="mt-2 min-h-20 w-full rounded-xl border border-[#e7e9e2] bg-[#fcfcfa] p-3 text-base outline-none placeholder:text-[#a7ada7] focus:border-[#68ad89]" /></label>
              <label className="mb-4 block text-sm font-medium">English {type === "sentence" ? "translation" : "meaning"}<textarea required value={form.english} onChange={(event) => setForm({ ...form, english: event.target.value })} placeholder={type === "sentence" ? "The weather is beautiful today." : "beautiful"} className="mt-2 min-h-20 w-full rounded-xl border border-[#e7e9e2] bg-[#fcfcfa] p-3 text-sm outline-none placeholder:text-[#a7ada7] focus:border-[#68ad89]" /></label>
              {type === "vocabulary" && <label className="mb-4 block text-sm font-medium">Example (optional)<input value={form.example} onChange={(event) => setForm({ ...form, example: event.target.value })} placeholder="The garden is beautiful." className="mt-2 w-full rounded-xl border border-[#e7e9e2] bg-[#fcfcfa] px-3 py-3 text-sm outline-none placeholder:text-[#a7ada7] focus:border-[#68ad89]" /></label>}
              <label className="mb-5 block text-sm font-medium">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-2 w-full rounded-xl border border-[#e7e9e2] bg-[#fcfcfa] px-3 py-3 text-sm outline-none focus:border-[#68ad89]">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <button disabled={saving} className="w-full rounded-xl bg-[#d2f0dd] px-4 py-3 text-sm font-semibold text-[#204635] transition hover:bg-[#bfe6cd] disabled:opacity-50">{saving ? "Saving…" : "Save to my library"}</button>
              <p className="mt-3 text-center text-xs leading-5 text-[#98a198]">One pair at a time. Your entries are saved in your connected database.</p>
            </form>
          </div>
          <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-[#e6e8e0] pt-5 text-xs text-[#929c94]"><span>Bhasha · Your personal Bangla to English practice space</span><span>Practice at your own pace</span></footer>
        </section>
      </div>
    </main>
  );
}
