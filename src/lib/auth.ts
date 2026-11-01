import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const sessionCookie = "bhasha_admin_session";
const sessionHours = 8;

function signingKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Admin session secret is not configured.");
  return new TextEncoder().encode(secret);
}

export async function createAdminSession(username: string) {
  const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(signingKey());

  (await cookies()).set(sessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function isAdminAuthenticated() {
  const email = process.env.ADMIN_EMAIL;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!email || !token) return false;

  try {
    const { payload } = await jwtVerify(token, signingKey());
    return payload.sub === email && payload.role === "admin";
  } catch {
    return false;
  }
}

export async function clearAdminSession() {
  (await cookies()).delete(sessionCookie);
}
