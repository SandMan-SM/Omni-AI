import { redirect } from "next/navigation";

// The sign-in surface is /login. A bare /auth link used to land on the
// global not-found page, which Next.js serves with a 200 status — a soft
// 404 that reads as a broken page to a crawler and to a customer who
// clicked "Sign in". Redirecting keeps any external reference working.
//
// /auth/callback remains a route handler in this directory; a page and a
// route handler can coexist under the same segment.

// Without this, Next.js prerenders the redirect at build time and serves it
// as a 200 with a `<meta http-equiv="refresh">` tag — a browser still lands
// on /login, but a crawler reads a 200 "success" for a page that has no
// content. force-dynamic moves the redirect to request time, which answers
// with a real 307 and a Location header.
export const dynamic = "force-dynamic";

export default function AuthRedirect(): never {
  redirect("/login");
}
