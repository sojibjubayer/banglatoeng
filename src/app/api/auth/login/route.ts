import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSession } from "@/lib/auth";

function safeEqual(value: string, expected: string) {
  const valueBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  if (valueBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(valueBytes, expectedBytes);
}

export async function POST(request: NextRequest) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!email || !password || !secret || secret.length < 32) {
    return NextResponse.json({ error: "Admin sign-in is not configured. Set the admin values in .env.local and restart the app." }, { status: 503 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your admin email and password." }, { status: 400 });
  }

  const validEmail = typeof body.email === "string" && safeEqual(body.email.trim().toLowerCase(), email.trim().toLowerCase());
  const validPassword = typeof body.password === "string" && safeEqual(body.password, password);
  if (!validEmail || !validPassword) {
    return NextResponse.json({ error: "That username or password is not correct." }, { status: 401 });
  }

  try {
    await createAdminSession(email);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not start the admin session. Check the server settings." }, { status: 500 });
  }
}
