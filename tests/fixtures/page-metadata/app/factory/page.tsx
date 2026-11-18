// Its metadata is built by a call, so the shape of the value is the
// factory's business, not the gate's. It must not be reported.

function buildMetadata(input: { path: string; title: string; description: string }) {
  return { ...input, canonical: input.path };
}

export const metadata = buildMetadata({
  path: "/factory",
  title: "Fixture factory page",
  description: "Metadata built by a factory call.",
});

export default function FactoryPage() {
  return <main>factory</main>;
}
