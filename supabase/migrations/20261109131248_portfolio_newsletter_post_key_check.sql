-- PostgreSQL's regex engine rejects bounded repetition above 255. Keep the
-- namespace/whitespace check in the regex and enforce length separately.
ALTER TABLE public.portfolio_newsletter_classifications
  DROP CONSTRAINT IF EXISTS portfolio_newsletter_classifications_post_key_check;

ALTER TABLE public.portfolio_newsletter_classifications
  ADD CONSTRAINT portfolio_newsletter_classifications_post_key_check
  CHECK (length(post_key) <= 320 AND post_key ~ '^(newsletter|federation|success|leadfranchise|newsroom|imperium|static):[^[:space:]]+$');
