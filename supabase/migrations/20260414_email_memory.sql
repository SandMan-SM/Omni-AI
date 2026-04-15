-- Newsletter email memory system — Apr 14 2026

ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS send_feedback TEXT;

CREATE TABLE IF NOT EXISTS public.email_send_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.newsletter_posts(id),
  subject TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recipients_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  open_rate FLOAT DEFAULT 0,
  click_rate FLOAT DEFAULT 0,
  notes TEXT,
  improvement_tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage email_send_logs" ON public.email_send_logs
  FOR ALL USING (true) WITH CHECK (true);