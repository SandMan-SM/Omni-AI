"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Post {
  slug: string;
  subject: string;
  intro: string;
  keywords: string[] | null;
  tier: string;
  published_at: string;
}

export function NewsletterHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("omni_user");
    setIsLoggedIn(!!user);
  }, []);

  return (
    <header className="border-b border-white/5">
      <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gradient">
          Omni AI
        </Link>
        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/?signin=true"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Subscribe
          </Link>
        )}
      </div>
    </header>
  );
}

export function PremiumSection({ posts }: { posts: Post[] }) {
  const [status, setStatus] = useState<"loading" | "premium" | "not-premium">("loading");

  useEffect(() => {
    async function check() {
      try {
        const userStr = localStorage.getItem("omni_user");
        if (!userStr) {
          setStatus("not-premium");
          return;
        }
        const user = JSON.parse(userStr);

        // Check profile from database for real-time premium status
        const supabase = createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_premium, subscription_status, tier")
          .eq("id", user.id)
          .single();

        if (
          profile?.is_premium === true ||
          profile?.subscription_status === "active" ||
          (profile?.tier !== null && (profile?.tier ?? 0) >= 2)
        ) {
          setStatus("premium");
        } else {
          setStatus("not-premium");
        }
      } catch {
        setStatus("not-premium");
      }
    }
    check();
  }, []);

  if (posts.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xl font-bold text-yellow-400">Interlinked</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-semibold">
          PREMIUM
        </span>
      </div>

      {status === "loading" ? (
        <div className="p-8 rounded-xl bg-yellow-500/[0.03] border border-yellow-500/[0.12] text-center">
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      ) : status === "not-premium" ? (
        <div className="p-8 rounded-xl bg-yellow-500/[0.03] border border-yellow-500/[0.12] text-center">
          <p className="text-gray-400 mb-1">Unlock exclusive Interlinked premium newsletters.</p>
          <p className="text-sm text-gray-600 mb-5">
            {posts.length} exclusive issue{posts.length !== 1 ? "s" : ""} available
          </p>
          <Link
            href="/newsletter/premium/info"
            className="inline-block bg-gradient-to-r from-yellow-600 to-yellow-500 text-black px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Learn More
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const date = new Date(post.published_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Link
                key={post.slug}
                href={`/newsletter/${post.slug}`}
                className="block group p-5 rounded-xl bg-yellow-500/[0.02] border border-yellow-500/[0.08] hover:border-yellow-500/20 hover:bg-yellow-500/[0.04] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white group-hover:text-yellow-300 transition-colors truncate">
                      {post.subject}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.intro}</p>
                    {post.keywords && post.keywords.length > 0 && (
                      <details className="mt-2 group/tags">
                        <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors list-none flex items-center gap-1">
                          <svg
                            className="w-3 h-3 transition-transform group-open/tags:rotate-180"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {post.keywords.length} tags
                        </summary>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {post.keywords.slice(0, 6).map((kw: string) => (
                            <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-500">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 flex-shrink-0">{date}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
