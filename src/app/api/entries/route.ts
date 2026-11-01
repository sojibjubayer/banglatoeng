import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

const allowedTypes = ["sentence", "vocabulary"] as const;
type EntryType = (typeof allowedTypes)[number];

function validType(value: string | null): value is EntryType {
  return value !== null && allowedTypes.includes(value as EntryType);
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (!validType(type)) return NextResponse.json({ error: "Choose sentences or vocabulary." }, { status: 400 });
  try {
    const client = await clientPromise;
    const entries = await client.db(process.env.MONGODB_DB || "bangla_to_english")
      .collection("entries")
      .find({ type })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    return NextResponse.json({ entries: entries.map((entry) => ({ ...entry, _id: String(entry._id) })) });
  } catch (error) {
    console.error("MongoDB read failed:", error);
    return NextResponse.json({ error: "MongoDB is not connected yet. Set MONGODB_URI in .env.local and restart the app." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: { type?: string; bangla?: string; english?: string; category?: string; example?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send a valid entry." }, { status: 400 });
  }
  if (!validType(body.type || "") || !body.bangla?.trim() || !body.english?.trim() || !body.category?.trim()) {
    return NextResponse.json({ error: "Bangla, English, and category are required." }, { status: 400 });
  }
  try {
    const client = await clientPromise;
    const entry = {
      type: body.type,
      bangla: body.bangla.trim(),
      english: body.english.trim(),
      category: body.category.trim(),
      ...(body.example?.trim() ? { example: body.example.trim() } : {}),
      createdAt: new Date(),
    };
    const result = await client.db(process.env.MONGODB_DB || "bangla_to_english").collection("entries").insertOne(entry);
    return NextResponse.json({ entry: { ...entry, _id: new ObjectId(result.insertedId).toString() } }, { status: 201 });
  } catch (error) {
    console.error("MongoDB save failed:", error);
    return NextResponse.json({ error: "Could not save to MongoDB. Check the connection settings in .env.local." }, { status: 503 });
  }
}
