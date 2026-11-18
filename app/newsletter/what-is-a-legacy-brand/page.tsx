import LegacyBrandStory, { legacyBrandMetadata } from '@/components/LegacyBrandStory';

export const metadata = legacyBrandMetadata();

export default function LegacyBrandIssue() {
  return <><LegacyBrandStory/><aside className="bg-stone-950 px-6 py-12 text-center text-stone-100"><h2 className="font-serif text-3xl">You made it to the last line.</h2><p className="my-4">Get the next issue directly in your inbox.</p><a className="underline" href="/reader">Subscribe to Interlinked</a></aside></>;
}
