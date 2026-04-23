import Link from "next/link";

/**
 * Visible breadcrumb navigation — the on-page counterpart to the
 * BreadcrumbList JSON-LD already shipping on /faq, /about, /pricing,
 * /vs, /vs/[competitor], and the dynamic content routes.
 *
 * Why visible matters on top of the schema:
 *  1. Google's SERP "breadcrumb chip" treatment is most reliably
 *     awarded when both the schema and visible markup agree — sites
 *     with schema-only breadcrumbs trigger the chip intermittently.
 *  2. Users escaping from a deep-page landing (LLM citation, Twitter
 *     share, AI search result) need a visible path back up. The
 *     footer carries site-wide links but a breadcrumb shows hierarchy.
 *  3. Accessibility: screen readers announce the nav landmark and
 *     the aria-label, so keyboard + assistive-tech users orient
 *     themselves faster than with raw footer links.
 *
 * Design: small text, gray-500 → gray-200 hover, chevron separators
 * (> character, decorative, aria-hidden). The current page is rendered
 * as plain span (no link, aria-current=page) so screen readers know
 * where the user is.
 */

export interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-xs text-gray-500 ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-2">
              {isLast ? (
                <span
                  aria-current="page"
                  className="text-gray-300 truncate max-w-[220px] sm:max-w-[360px]"
                >
                  {item.name}
                </span>
              ) : (
                <>
                  <Link
                    href={item.href}
                    className="text-gray-500 hover:text-gray-200 transition-colors"
                  >
                    {item.name}
                  </Link>
                  <span aria-hidden="true" className="text-gray-700">
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
