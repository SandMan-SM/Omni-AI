import { redirect } from "next/navigation";

// The sign-in surface is /login. A bare /auth link used to land on the
// global not-found page, which Next.js serves with a 200 status — a soft
// 404 that reads as a broken page to a crawler and to a customer who
// clicked "Sign in". Redirecting keeps any external reference working.
//
// /auth/callback remains a route handler in this directory; a page and a
// route handler can coexist under the same segment.

export default function AuthRedirect(): never {
  redirect("/login");
}
