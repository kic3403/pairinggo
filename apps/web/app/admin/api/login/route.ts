import { NextResponse } from "next/server";
import { checkPassword, COOKIE, issueToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const pw = String(form.get("password") || "");
  const url = new URL(req.url);
  if (!checkPassword(pw)) return NextResponse.redirect(new URL("/admin/login?e=1", url), 303);
  const res = NextResponse.redirect(new URL("/admin", url), 303);
  res.cookies.set(COOKIE, issueToken(7), { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge: 7 * 86400 });
  return res;
}
