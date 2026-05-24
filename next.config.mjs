/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local production builds use a separate dist directory so they never
  // clobber the dev server's `.next/`. Set NEXT_DIST_DIR=.next-prod when
  // running `npm run build:check` to avoid breaking the running dev server.
  // Vercel ignores this env var and uses its own clean infra.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['omnileadsagi.com', 'omni-ai-theta.vercel.app', 'localhost:3000'],
    },
  },
  async redirects() {
    return [
      // Federation case studies moved from /infrastructure/development
      // to /federation/case-studies. Permanent 301 keeps old links
      // (already shared via email) working.
      {
        source: '/infrastructure/development',
        destination: '/federation/case-studies',
        permanent: true,
      },
      {
        source: '/infrastructure/development/:slug',
        destination: '/federation/case-studies/:slug',
        permanent: true,
      },
      {
        source: '/infrastructure/development/:slug/opengraph-image',
        destination: '/federation/case-studies/:slug/opengraph-image',
        permanent: true,
      },
      // /alira/referral/full → /alira/referral/info (2026-05-24
      // rename for parity with /renelaveau/referral/info). Keeps
      // any links already shared via email/DM working.
      {
        source: '/alira/referral/full',
        destination: '/alira/referral/info',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // HSTS: force HTTPS for 2 years + include subdomains + allow
          // submission to the Chrome preload list. Vercel already serves
          // HTTPS + redirects HTTP — this header tells browsers to remember
          // that and skip the redirect round-trip on subsequent visits,
          // which also closes the window where a MITM can downgrade the
          // first request. Submitting to hstspreload.org (once this header
          // is live) bakes the policy into the browser binary so even a
          // clean-install browser is protected on its first visit.
          //
          // Safe to ship: the site has no http:// surface to lose. If a
          // future dev subdomain ever needs http:// we'd drop
          // includeSubDomains + preload — remove both together or the
          // preload submission becomes invalid.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
