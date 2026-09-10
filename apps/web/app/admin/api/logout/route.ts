import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", new URL(req.url)), 303);
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
