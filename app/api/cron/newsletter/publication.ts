/** Match the public archive's visibility rules before skipping publication. */
export async function findPublishedIssueForToday(
  supabase: any,
  tier: 'free' | 'premium',
  now = new Date(),
) {
  const date = now.toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const slug = `interlinked-${tier}-${date}`;

  const { data: bySlug, error: slugError } = await supabase
    .from('newsletter_posts')
    .select('id, slug, subject, tier, published_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .maybeSingle();

  // A failed read is not proof that no issue exists: block publication rather
  // than risk a duplicate write or a misleading successful cron receipt.
  if (slugError) throw new Error(`Newsletter publication lookup failed (${tier}, slug)`);
  if (bySlug) return bySlug;

  const { data: byDate, error: dateError } = await supabase
    .from('newsletter_posts')
    .select('id, slug, subject, tier, published_at')
    .eq('tier', tier)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .gte('published_at', start.toISOString())
    .lt('published_at', end.toISOString())
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dateError) throw new Error(`Newsletter publication lookup failed (${tier}, date)`);
  return byDate ?? null;
}
