/**
 * cycleDetection.test.ts
 * Usage examples + test cases for cycleDetection.ts
 * Run with: npx ts-node cycleDetection.test.ts
 *       or: npx jest cycleDetection.test.ts
 */

import {
  detectCycles,
  findBlockers,
  suggestFixes,
  validateBeforeSave,
  GraphNode,
} from "./cycleDetection";

// ─── 1. Clean graph — no cycles ───────────────────────────────────────────────

const cleanGraph: GraphNode[] = [
  { id: "Idea-1",    dependsOn: [] },
  { id: "Project-1", dependsOn: ["Idea-1"] },
  { id: "Task-1",   dependsOn: ["Project-1"] },
  { id: "Task-2",   dependsOn: ["Project-1"] },
  { id: "Task-3",   dependsOn: ["Task-1", "Task-2"] },
  { id: "Deploy",   dependsOn: ["Task-3"] },
];

const clean = detectCycles(cleanGraph);
console.log("── Clean graph ──────────────────────────────");
console.log("Has cycle:", clean.hasCycle);               // false
console.log("Order:", clean.topologicalOrder.join(" → ")); // safe execution order

// ─── 2. Direct cycle — A ↔ B ─────────────────────────────────────────────────

const directCycle: GraphNode[] = [
  { id: "A", dependsOn: ["B"] },
  { id: "B", dependsOn: ["A"] },   // ← closes the cycle
  { id: "C", dependsOn: ["B"] },
];

const dc = detectCycles(directCycle);
console.log("\n── Direct cycle (A ↔ B) ─────────────────────");
console.log("Has cycle:", dc.hasCycle);           // true
console.log("Cycles:", dc.cycles);                // [["A","B","A"]] or similar
console.log("Affected:", [...dc.affectedNodes]);  // ["A","B"]
console.log("Fixes:", suggestFixes(directCycle));

// ─── 3. Transitive cycle — A → B → C → A ─────────────────────────────────────

const transitiveCycle: GraphNode[] = [
  { id: "A", dependsOn: ["C"] },
  { id: "B", dependsOn: ["A"] },
  { id: "C", dependsOn: ["B"] },   // ← closes the 3-node cycle
  { id: "D", dependsOn: ["A"] },   // downstream — gets "upstream_blocked"
];

const tc = detectCycles(transitiveCycle);
console.log("\n── Transitive cycle (A→B→C→A) ───────────────");
console.log("Has cycle:", tc.hasCycle);           // true
console.log("Cycles:", tc.cycles);
console.log("Fixes:", suggestFixes(transitiveCycle));

// ─── 4. findBlockers — cascade effect ────────────────────────────────────────

const blockers = findBlockers(transitiveCycle);
console.log("\n── Blockers ──────────────────────────────────");
blockers.forEach(b =>
  console.log(`  ${b.nodeId}: ${b.reason} (blocked by: ${b.blockedBy.join(", ") || "—"})`)
);
// D is "upstream_blocked" even though it's not in the cycle

// ─── 5. validateBeforeSave — guard on save/update ────────────────────────────

const safeTasks: GraphNode[] = [
  { id: "T1", dependsOn: [] },
  { id: "T2", dependsOn: ["T1"] },
  { id: "T3", dependsOn: ["T2"] },
];

console.log("\n── validateBeforeSave ────────────────────────");

// Safe: T1 depending on nothing new
try {
  validateBeforeSave(safeTasks, "T1", []);
  console.log("T1 update: ✓ safe");
} catch (e: any) {
  console.error("T1 update:", e.message);
}

// Dangerous: making T1 depend on T3 → T1 → T2 → T3 → T1
try {
  validateBeforeSave(safeTasks, "T1", ["T3"]);
  console.log("T1 → T3: ✓ safe");
} catch (e: any) {
  console.error("T1 → T3:", e.message); // ← throws with cycle description
}

// ─── 6. StartupHub real-world scenario ───────────────────────────────────────
// Idea → Project → Task → (triggers comms) → Idea update → cycle

const startupHub: GraphNode[] = [
  { id: "idea:launch-v2",    dependsOn: [] },
  { id: "project:backend",   dependsOn: ["idea:launch-v2"] },
  { id: "task:build-api",    dependsOn: ["project:backend"] },
  { id: "task:write-tests",  dependsOn: ["task:build-api"] },
  { id: "task:deploy",       dependsOn: ["task:write-tests"] },
  { id: "comms:slack-notify", dependsOn: ["task:deploy"] },
  // BUG: the Slack notification triggers an idea update which re-queues the project
  { id: "idea:launch-v2-update", dependsOn: ["comms:slack-notify", "idea:launch-v2"] },
  // If idea:launch-v2 depended on idea:launch-v2-update → cycle
  // Uncomment below to trigger the error your app shows:
  // { id: "idea:launch-v2", dependsOn: ["idea:launch-v2-update"] },
];

const sh = detectCycles(startupHub);
console.log("\n── StartupHub graph ──────────────────────────");
console.log("Has cycle:", sh.hasCycle);   // false (clean as-is)
console.log("Safe execution order:");
sh.topologicalOrder.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
