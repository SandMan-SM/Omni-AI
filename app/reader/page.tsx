import type { Metadata } from "next";
import Link from "next/link";
import { ReaderForm } from "./reader-form";
import styles from "./reader.module.css";

export const metadata: Metadata = {
  title: "Reader sign-in | Interlinked",
  description:
    "Sign in by email to read and receive the daily Interlinked briefing from AIS Empire.",
  robots: { index: false, follow: true },
};
export default async function ReaderPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const source =
    (await searchParams).source === "omnios" ? "omnios" : "interlinked";
  return (
    <main className={styles.shell}>
      <header>
        <Link href="/">Interlinked</Link>
        <span>AIS Empire</span>
      </header>
      <section className={styles.column}>
        <ReaderForm source={source} />
      </section>
      <footer>
        <Link href="/newsletter/archive">Issue archive</Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
