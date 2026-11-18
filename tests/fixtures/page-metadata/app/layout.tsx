// The fixture root layout declares NO metadata, so a page under it that
// declares none either is a page that would ship with no title.

export default function FixtureRootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
