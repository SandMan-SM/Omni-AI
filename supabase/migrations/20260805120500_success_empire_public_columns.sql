-- Published Success Empire articles are public, but delivery receipts,
-- generation metadata, sender addresses, and source-context fingerprints are
-- operational data and must remain service-role only.

revoke all on public.success_empire_entries from anon, authenticated;

grant select (
  id,
  publication_date,
  kind,
  slug,
  title,
  deck,
  salutation,
  sections,
  closing,
  signature,
  principle_slug,
  tags,
  published_at,
  sender_name
) on public.success_empire_entries to anon, authenticated;
