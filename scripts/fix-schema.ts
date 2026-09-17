import { ConvexHttpClient } from "convex/browser";

// One-off: clear legacy "projects" docs that block the new schema
// (scene_count went from string|number to number, stage_status shape changed).
const client = new ConvexHttpClient("http://127.0.0.1:3210");
const projects: any[] = await client.query("projects:list" as any, { userId: "*" }).catch(() => []);
console.log(`found ${projects.length} projects`);
for (const p of projects) {
  console.log("removing", p._id, p.title);
  await client.mutation("projects:remove" as any, { id: p._id, userId: p.userId });
}
console.log("done");
process.exit(0);
