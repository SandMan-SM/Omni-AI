-- Draft inserts must not inherit a publication timestamp. Writers that publish
-- already set both status='published' and published_at explicitly. This changes
-- future insert defaults only; existing drafts and public issues stay intact.
alter table public.newsletter_posts alter column published_at drop default;
