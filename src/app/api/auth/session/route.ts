import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ isAdmin: await isAdminAuthenticated() });
}
