"use client";

// Generic cross-portfolio sponsor placements are retired. Keep the existing
// component API so older newsletter pages remain compatible without rendering
// ads or sending sponsor events. Custom editorial partnerships are separate.
type Props = {
  host: string;
  eyebrow?: string;
  intro?: string;
};

export default function SponsorRotation(_props: Props) {
  return null;
}
