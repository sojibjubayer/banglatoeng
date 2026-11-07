import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import getMongoClient from "@/lib/mongodb";
import { isAdminAuthenticated } from "@/lib/auth";

const allowedTypes = ["sentence", "vocabulary"] as const;
const pageSize = 50;
type EntryType = (typeof allowedTypes)[number];

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Sign in as admin to edit entries." }, { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Please send a valid entry." }, { status: 400 });
  }
  if (!body || typeof body._id !== "string" || !/^[a-f\d]{24}$/i.test(body._id) ||
      ![body.bangla, body.english, body.category].every((value) => typeof value === "string" && value.trim()) ||
      (body.example !== undefined && typeof body.example !== "string")) {
    return NextResponse.json({ error: "Bangla, English, and category are required." }, { status: 400 });
  }
  try {
    const client = await getMongoClient();
    const collection = client.db(process.env.MONGODB_DB || "bhasha_app").collection("entries");
    const _id = new ObjectId(body._id);
    const entry = await collection.findOneAndUpdate({ _id }, { $set: {
      bangla: body.bangla.trim(), english: body.english.trim(), category: body.category.trim(),
      example: (body.example || "").trim(), updatedAt: new Date(),
    } }, { returnDocument: "after" });
    if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    return NextResponse.json({ entry: { ...entry, _id: String(entry._id) } });
  } catch {
    return NextResponse.json({ error: "Could not update this entry. Please try again." }, { status: 503 });
  }
}

function validType(value: string | null): value is EntryType {
  return value !== null && allowedTypes.includes(value as EntryType);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  if (!validType(type)) return NextResponse.json({ error: "Choose sentences or vocabulary." }, { status: 400 });

  const requestedPage = Number.parseInt(params.get("page") || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const category = params.get("category");
  const query: { type: EntryType; category?: string } = { type };
  if (category && category !== "All categories") query.category = category;

  try {
    const client = await getMongoClient();
    const collection = client.db(process.env.MONGODB_DB || "bhasha_app").collection("entries");
    const [entries, total, categories] = await Promise.all([
      collection.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      collection.countDocuments(query),
      collection.distinct("category", { type }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return NextResponse.json({
      entries: entries.map((entry) => ({ ...entry, _id: String(entry._id) })),
      page,
      pageSize,
      total,
      totalPages,
      categories: categories.filter((value): value is string => typeof value === "string" && value.trim().length > 0).sort(),
    });
  } catch (error) {
    console.error("MongoDB read failed:", error);
    const message = error instanceof Error && error.message.startsWith("Missing MONGODB_URI")
      ? "MongoDB is not connected yet. Add MONGODB_URI to .env.local and restart the app."
      : "Could not load entries from MongoDB. Check your connection settings.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Sign in as admin to add entries." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send a valid entry." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Please send a valid entry." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const isBatch = Array.isArray(payload.entries);
  const rawEntries = isBatch ? payload.entries as unknown[] : [payload];
  if (rawEntries.length === 0 || rawEntries.length > 100) {
    return NextResponse.json({ error: "Save between 1 and 100 entries at a time." }, { status: 400 });
  }
  if (rawEntries.some((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return true;
    const entry = value as Record<string, unknown>;
    return !validType(typeof entry.type === "string" ? entry.type : "") ||
      typeof entry.bangla !== "string" || !entry.bangla.trim() ||
      typeof entry.english !== "string" || !entry.english.trim() ||
      typeof entry.category !== "string" || !entry.category.trim() ||
      (entry.example !== undefined && typeof entry.example !== "string");
  })) {
    return NextResponse.json({ error: "Every entry needs Bangla, English, and a category." }, { status: 400 });
  }
  try {
    const client = await getMongoClient();
    const entries = rawEntries.map((value) => {
      const entry = value as Record<string, string>;
      return {
        type: entry.type as EntryType,
        bangla: entry.bangla.trim(),
        english: entry.english.trim(),
        category: entry.category.trim(),
        ...(entry.example?.trim() ? { example: entry.example.trim() } : {}),
        createdAt: new Date(),
      };
    });
    const result = await client.db(process.env.MONGODB_DB || "bhasha_app").collection("entries").insertMany(entries, { ordered: true });
    if (!isBatch) {
      return NextResponse.json({ entry: { ...entries[0], _id: new ObjectId(result.insertedIds[0]).toString() } }, { status: 201 });
    }
    return NextResponse.json({ saved: entries.length }, { status: 201 });
  } catch (error) {
    console.error("MongoDB save failed:", error);
    const message = error instanceof Error && error.message.startsWith("Missing MONGODB_URI")
      ? "MongoDB is not connected yet. Add MONGODB_URI to .env.local and restart the app."
      : "Could not save the entries. Check your connection settings.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}