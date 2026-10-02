/**
 * Export the sign-in email list (leads) to a CSV.
 *
 * Usage (from the project root):
 *   bun scripts/export-leads.ts                 # -> leads.csv
 *   bun scripts/export-leads.ts my-list.csv     # custom filename
 *
 * CSV columns: email, name, email_domain, signin_count, last_seen, created_at
 * Open it in Excel/Sheets, or import into any newsletter tool.
 *
 * CAN-SPAM / anti-spam reminder for the operator: every marketing email sent
 * to this list MUST include (1) a working unsubscribe/opt-out link honored
 * within 10 days, and (2) the sender's valid physical postal address.
 * The site's Privacy Policy promises this — keep it true.
 */
import { ConvexHttpClient } from "convex/browser";
import { writeFileSync } from "node:fs";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210");

type Lead = {
  email: string;
  name: string;
  email_domain: string;
  signin_count: number;
  last_seen: number;
  _creationTime: number;
};

const leads = (await (client as any).query("leadsAdmin:list" as any, {})) as Lead[];

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const header = "email,name,email_domain,signin_count,last_seen,created_at";
const rows = leads.map((l) =>
  [
    l.email,
    l.name,
    l.email_domain,
    l.signin_count,
    new Date(l.last_seen).toISOString(),
    new Date(l._creationTime).toISOString(),
  ]
    .map(csvEscape)
    .join(",")
);

const out = process.argv[2] ?? "leads.csv";
writeFileSync(out, [header, ...rows].join("\n") + "\n");
console.log(`Exported ${leads.length} leads -> ${out}`);
process.exit(0);
