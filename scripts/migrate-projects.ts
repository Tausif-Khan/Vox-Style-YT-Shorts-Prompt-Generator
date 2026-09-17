import { ConvexHttpClient } from "convex/browser";

// One-off: migrate legacy 6-stage projects to the 3-stage schema.
// scene_count "auto" -> resolved number; stage_status -> { story, script, scenes }.
const client = new ConvexHttpClient("http://127.0.0.1:3210");
const projects: any[] = await (client as any).query("projects:listAll" as any, {});
console.log(`found ${projects.length} projects`);
for (const p of projects) {
  const legacy = typeof p.scene_count !== "number" || !("story" in (p.stage_status ?? {}) && !("research" in p.stage_status));
  if (!legacy) continue;
  console.log("migrating", p._id, p.title);
  await (client as any).mutation("projects:migrateLegacy" as any, { id: p._id });
}
console.log("done");
process.exit(0);
