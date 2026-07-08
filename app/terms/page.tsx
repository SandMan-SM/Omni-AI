import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Omni AI",
  description: "Terms of Service for Omni AI.",
  alternates: { canonical: "https://omnileadsagi.com/terms" },
  robots: { index: true, follow: true },
};

const UPDATED = "July 7, 2026";
const SECTIONS: [string, string[]][] = [["Agreement to Terms", ["These Terms of Service govern your use of the Omni AI website. By accessing or using the site, you agree to these Terms. If you do not agree, please do not use the site."]], ["Use of the Site", ["You may use this site only for lawful purposes. You agree not to misuse it, interfere with its operation, attempt unauthorized access, or use it in any way that could harm us or others."]], ["Intellectual Property", ["All content on this site, including text, graphics, logos, and design, is owned by or licensed to Omni AI and is protected by applicable intellectual-property laws. You may not copy, reproduce, or distribute it without our prior written permission."]], ["Submissions", ["If you send us information through a form, email, or other means, you confirm it is accurate and that you have the right to share it, and you permit us to use it to respond to and serve you."]], ["Third-Party Links and Services", ["The site may reference or link to third-party websites and services that we do not control. We are not responsible for their content, policies, or practices."]], ["Purchases, Payments, and Refunds", ["Certain services may be offered for purchase through the site. Prices are shown at the point of sale and may change. Payments are handled by third-party processors (such as Stripe or PayPal), and by purchasing you agree to their terms as well as ours.", "Subscription services renew automatically for successive terms until cancelled, and any minimum commitment, setup fee, or billing cycle disclosed at checkout applies. Refund and cancellation terms are those presented at the time of purchase; if none are stated, contact us and we will work with you in good faith."]], ["Disclaimers", ["The site and its content are provided “as is” and “as available” without warranties of any kind, express or implied. Omni AI does not warrant that the site will be uninterrupted, error-free, or free of harmful components."]], ["Limitation of Liability", ["To the fullest extent permitted by law, Omni AI will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss arising from your use of, or inability to use, the site."]], ["Indemnification", ["You agree to indemnify and hold Omni AI harmless from any claims, damages, or expenses arising out of your use of the site or your violation of these Terms."]], ["Governing Law", ["These Terms are governed by the laws of the State of Utah, USA, without regard to its conflict-of-law rules. Any dispute will be handled in the state or federal courts located in Utah."]], ["Changes to These Terms", ["We may update these Terms from time to time. Continued use of the site after changes are posted means you accept the updated Terms."]], ["Termination", ["We may suspend or discontinue access to the site, in whole or in part, at any time and without notice."]], ["Contact Us", ["Questions about these Terms can be sent to Omni AI at hello@omnileadsagi.com, Utah, USA."]]];

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "72px 20px", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", lineHeight: 1.7, color: "inherit" }}>
      <h1 style={{ fontSize: 34, fontWeight: 700, margin: "0 0 8px" }}>Terms of Service</h1>
      <p style={{ opacity: 0.65, margin: "0 0 40px" }}>Last updated {UPDATED}</p>
      {SECTIONS.map(([heading, paras], i) => (
        <section key={i} style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>{heading}</h2>
          {paras.map((t, j) => (<p key={j} style={{ margin: "0 0 12px" }}>{t}</p>))}
        </section>
      ))}
    </main>
  );
}
