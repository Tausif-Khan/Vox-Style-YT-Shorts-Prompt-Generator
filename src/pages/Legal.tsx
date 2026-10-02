import { Link } from "react-router-dom";
import { Layers, ArrowLeft } from "lucide-react";

/**
 * Single combined legal page: /legal (also serves legacy /privacy, /terms, /dmca).
 * Contact page: /contact — shows the operator email directly.
 * Plain-language policies matching what the app actually does:
 * - collects name + email only (no passwords), after a 13+ age confirmation
 * - sends user topics to a third-party AI API to generate content
 * - free service, no billing, no subscriptions
 * No postal address is published anywhere (contact happens via email).
 */

function ContactLine() {
  return (
    <p>
      Questions or requests? Visit the{" "}
      <Link to="/contact" className="text-amber-film underline underline-offset-2 hover:text-amber-film/80">
        Contact page
      </Link>{" "}
      — you'll find our email address there and can write to us directly.
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-serif text-xl text-bone-50">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-bone-300">{children}</div>
    </section>
  );
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-bone-400 hover:text-bone-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Papercut Studio
      </Link>
      <div className="panel p-8 md:p-10">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-film/10 ring-1 ring-amber-film/30">
            <Layers className="h-4 w-4 text-amber-film" strokeWidth={1.75} />
          </span>
          <span className="text-[13px] font-bold tracking-[0.16em] text-bone-100">PAPERCUT STUDIO</span>
        </div>
        <h1 className="mb-2 font-serif text-3xl text-bone-50">{title}</h1>
        <p className="mb-8 text-xs uppercase tracking-[0.14em] text-bone-400">
          Last updated: September 21, 2026
        </p>

        {/* Jump links */}
        <nav className="mb-10 flex flex-wrap gap-2">
          {[
            ["Privacy Policy", "/legal#privacy"],
            ["Terms of Service", "/legal#terms"],
            ["DMCA Policy", "/legal#dmca"],
            ["Contact", "/contact"],
          ].map(([label, href]) => (
            <a key={label} href={href} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-bone-200 transition hover:border-white/40 hover:text-white">
              {label}
            </a>
          ))}
        </nav>

        {children}

        <div className="panel-soft mt-10 p-5">
          <ContactLine />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── PRIVACY POLICY ─────────────────────────── */

function Privacy() {
  return (
    <>
      <h2 id="privacy" className="mb-6 scroll-mt-8 font-serif text-2xl text-amber-film">Privacy Policy</h2>
      <Section title="What we collect">
        <p>
          When you start using the tool we ask for your <strong className="text-bone-100">name</strong> and{" "}
          <strong className="text-bone-100">email address</strong> — and nothing else. We do not ask for or store
          passwords, payment details, phone numbers, or dates of birth.
        </p>
        <p>
          We also store the topics you type and the documents the tool generates for you, so you can pick up your
          projects later on the same device.
        </p>
      </Section>
      <Section title="Children's privacy (COPPA)">
        <p>
          This service is <strong className="text-bone-100">not directed to children under 13</strong>. Before we
          collect an email address we require an affirmative confirmation that you are 13 years of age or older. We
          do not knowingly collect personal information from children under 13. If you believe a child under 13 has
          provided us with personal information, use the{" "}
          <Link to="/contact" className="text-amber-film underline underline-offset-2">contact page</Link> and we
          will delete it promptly.
        </p>
      </Section>
      <Section title="How your information is used">
        <p>We use your name and email only to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>remember you on your device so you don't re-enter it;</li>
          <li>maintain and improve the service;</li>
          <li>contact you about this service if you ask us to (via the contact page).</li>
        </ul>
        <p>
          We do <strong className="text-bone-100">not sell</strong> your personal information, ever. If we ever
          email you (for example a product update), every message will contain a working unsubscribe link and will
          honor opt-outs promptly.
        </p>
      </Section>
      <Section title="Third-party services we rely on">
        <p>
          To generate your story, script and scene prompts, the topics you enter are sent to a third-party
          artificial-intelligence API provider. Your topics are processed by that provider to produce your results;
          they are governed by that provider's own terms. We do not send your email address to the AI provider.
        </p>
        <p>
          The site displays advertising (Google AdSense). Advertising partners may set their own cookies subject to
          their policies. Fonts are self-hosted — your browser is not sent to Google or any other font CDN.
        </p>
      </Section>
      <Section title="Cookies and tracking">
        <p>
          We keep a small entry in your browser's local storage so you stay signed in on your device. We do not run
          session-replay, heat-mapping, or behavior-tracking scripts. Form inputs are never recorded for replay
          purposes.
        </p>
      </Section>
      <Section title="Data retention and deletion">
        <p>
          Your email is kept until you ask us to delete it. Use the{" "}
          <Link to="/contact" className="text-amber-film underline underline-offset-2">contact page</Link> and
          include the email address you used — we will delete it (and anything tied to it) within two to three
          days.
        </p>
      </Section>
      <Section title="Contact">
        <ContactLine />
      </Section>
    </>
  );
}

/* ─────────────────────────── TERMS OF SERVICE ─────────────────────────── */

function Terms() {
  return (
    <>
      <h2 id="terms" className="mb-6 scroll-mt-8 font-serif text-2xl text-amber-film">Terms of Service</h2>
      <Section title="The service">
        <p>
          Papercut Studio is a <strong className="text-bone-100">free</strong> tool that generates story
          architectures, timed scripts, and image/video prompts for creating short videos in external tools such as
          Google Flow. There is no charge, no subscription, and no paid tier.
        </p>
      </Section>
      <Section title="No billing, no renewals, nothing to cancel">
        <p>
          Because the service is entirely free, there are no renewal terms, recurring charges, or subscriptions.
          Nothing here will ever bill you. If that ever changes, these terms will be updated and existing users will
          be notified before any charge could occur, with clear instructions for cancelling.
        </p>
      </Section>
      <Section title="What you create">
        <p>
          You own the scripts and prompts the tool generates for you, and any videos you make from them. You are
          responsible for how you use them — including following the terms of any platform you publish on (YouTube,
          Instagram, TikTok) and any tool you generate assets with (Google Flow, etc.).
        </p>
      </Section>
      <Section title="Acceptable use">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Do not submit topics that are unlawful, hateful, sexually explicit, or that infringe others' rights.</li>
          <li>Do not attempt to disrupt, overload, or reverse-engineer the service.</li>
          <li>Do not use temporary/disposable email addresses; we restrict sign-ups to well-known email providers.</li>
        </ul>
      </Section>
      <Section title="AI output disclaimer">
        <p>
          Generated stories and facts are produced by AI and may contain errors, omissions, or disputed claims.
          Verify anything you publish. The service is provided "as is" without warranties of any kind, to the
          maximum extent permitted by law.
        </p>
      </Section>
      <Section title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Papercut Studio and its operators are not liable for indirect,
          incidental, or consequential damages arising from your use of the service or content generated by it.
        </p>
      </Section>
      <Section title="Changes">
        <p>
          We may update these terms; the "last updated" date above will change. Continuing to use the service after
          an update means you accept the revised terms.
        </p>
      </Section>
      <Section title="Contact">
        <ContactLine />
      </Section>
    </>
  );
}

/* ─────────────────────────── DMCA POLICY ─────────────────────────── */

function Dmca() {
  return (
    <>
      <h2 id="dmca" className="mb-6 scroll-mt-8 font-serif text-2xl text-amber-film">DMCA Policy</h2>
      <Section title="Copyright policy">
        <p>
          Papercut Studio respects intellectual property rights. We respond to clear notices of alleged
          copyright infringement under the U.S. Digital Millennium Copyright Act ("DMCA").
        </p>
      </Section>
      <Section title="How to reach our copyright agent">
        <p>
          Send takedown notices and counter-notices to us via the{" "}
          <Link to="/contact" className="text-amber-film underline underline-offset-2">contact page</Link> — use
          the email address shown there with the subject line <strong className="text-bone-100">"DMCA Notice"</strong>.
        </p>
        <p className="text-xs text-bone-400">
          Operator note: a DMCA notice must include your physical address and signature (a scanned signature or
          electronic signature is fine) — those belong in the email you send us, not on this page. Also register
          the agent with the U.S. Copyright Office's online DMCA directory before launch.
        </p>
      </Section>
      <Section title="Filing a takedown notice">
        <p>If you believe content on this site infringes your copyright, send a notice that includes:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>a physical or electronic signature of the copyright owner or authorized agent;</li>
          <li>identification of the copyrighted work claimed to be infringed;</li>
          <li>the URL or specific location of the allegedly infringing material on this site;</li>
          <li>your contact information (address, telephone, email);</li>
          <li>a statement of good-faith belief that the use is unauthorized;</li>
          <li>a statement, under penalty of perjury, that the information is accurate and you are authorized to act.</li>
        </ul>
      </Section>
      <Section title="What happens next">
        <p>
          Valid notices are acted on promptly: we remove or disable the identified material and notify the affected
          user where appropriate. Repeat infringers lose access to the service. If your material was removed by
          mistake or misidentification, you may send a counter-notice to the same contact with the same elements
          plus consent to jurisdiction of your federal district court.
        </p>
      </Section>
    </>
  );
}

export default function Legal() {
  return (
    <LegalShell title="Legal">
      <Privacy />
      <Terms />
      <Dmca />
    </LegalShell>
  );
}
