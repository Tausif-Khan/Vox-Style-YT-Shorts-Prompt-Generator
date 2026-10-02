import { useState } from "react";
import { Link } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { ArrowLeft, Loader2, Send, CheckCircle2 } from "lucide-react";
import StudioMark from "../components/StudioMark";

/**
 * Contact page: /contact.
 * Submissions are emailed to the operator. The recipient address is
 * hardcoded in the backend (src/convex/contact.ts) and is never visible
 * on the page or in the client bundle.
 */
const REQUEST_TYPES = [
  { value: "privacy", label: "Privacy / data request (incl. email deletion)" },
  { value: "dmca", label: "DMCA / copyright notice" },
  { value: "other", label: "General question" },
];

export default function Contact() {
  const submitContact = useAction(api.contact.submit);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("privacy");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (sending) return;
    setError("");
    setSending(true);
    try {
      await submitContact({ name, email, request_type: requestType, message });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-bone-400 hover:text-bone-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Papercut Studio
      </Link>
      <div className="panel p-8 md:p-10">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-film/10 ring-1 ring-amber-film/30">
            <StudioMark className="h-5 w-5 text-amber-film" />
          </span>
          <span className="text-[13px] font-bold tracking-[0.16em] text-bone-100">PAPERCUT STUDIO</span>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-amber-film" strokeWidth={1.5} />
            <h1 className="mb-3 font-serif text-2xl text-bone-50">Request received</h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-bone-300">
              Thank you — your request has been sent. It will be catered to within
              <span className="font-semibold text-bone-100"> two to three days</span>.
            </p>
            <Link to="/" className="btn-secondary mt-6 inline-flex">
              Back to the tool
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-2 font-serif text-3xl text-bone-50">Contact us</h1>
            <p className="mb-8 text-sm leading-relaxed text-bone-300">
              Privacy requests, copyright notices, or anything else — send it here and
              we'll get back to you within <span className="font-semibold text-bone-100">two to three days</span>.
            </p>

            <label className="label-xs mb-2 block">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Creator"
              className="input-dark mb-4 w-full"
              maxLength={100}
            />

            <label className="label-xs mb-2 block">Your email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              type="email"
              className="input-dark mb-4 w-full"
              maxLength={200}
            />

            <label className="label-xs mb-2 block">Request type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="input-dark mb-4 w-full"
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <label className="label-xs mb-2 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your request. For email deletion, include the email address you used."
              rows={5}
              className="input-dark mb-4 w-full resize-none"
              maxLength={3000}
            />

            {error && (
              <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button className="btn-primary h-12 w-full text-base" disabled={sending} onClick={() => void handleSubmit()}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send request
                </>
              )}
            </button>

            <p className="mt-6 text-xs text-bone-400">
              See also our{" "}
              <Link to="/legal" className="underline underline-offset-2 hover:text-bone-200">
                Privacy Policy, Terms & DMCA
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
