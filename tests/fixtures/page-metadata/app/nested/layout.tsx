// A nested layout that DOES declare metadata. Next.js merges metadata down
// the layout chain, so the page beneath it inherits a title and a
// description — the gate must not report it.

export const metadata = {
  title: "Fixture nested layout",
  description: "A layout that supplies metadata to the pages beneath it.",
};

export default function FixtureNestedLayout({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>;
}
