/**
 * cycleDetection.ts
 * Cycle detection utility for task/project dependency graphs.
 * Works with any node type — tasks, ideas, projects, blockers.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  /** IDs of nodes this node depends on (i.e. must complete before this one) */
  dependsOn?: string[];
  /** IDs of nodes this node blocks (alternative edge direction) */
  blocks?: string[];
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  /** Each inner array is one cycle, listed as a chain of node IDs */
  cycles: string[][];
  /** Flat set of all node IDs involved in at least one cycle */
  affectedNodes: Set<string>;
  /** Nodes in safe topological order (empty if cycles exist) */
  topologicalOrder: string[];
}

export interface BlockerInfo {
  nodeId: string;
  blockedBy: string[];
  reason: "cycle" | "upstream_blocked";
}

// ─── Core: build adjacency list ───────────────────────────────────────────────

/**
 * Normalise mixed edge directions into a single adjacency map.
 * `dependsOn` edges: A → B means A depends on B (B must run first).
 * `blocks` edges:   A blocks B → same as B dependsOn A.
 */
function buildAdjacency(nodes: GraphNode[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  // Initialise every node (catches isolated nodes)
  for (const node of nodes) {
    if (!adj.has(node.id)) adj.set(node.id, []);
  }

  for (const node of nodes) {
    // dependsOn: node → dependency
    for (const dep of node.dependsOn ?? []) {
      adj.get(node.id)!.push(dep);
    }
    // blocks: node → blocked (reversed: blocked depends on node)
    for (const blocked of node.blocks ?? []) {
      if (!adj.has(blocked)) adj.set(blocked, []);
      adj.get(blocked)!.push(node.id);
    }
  }

  return adj;
}

// ─── Core: DFS cycle detection ────────────────────────────────────────────────

type VisitState = "unvisited" | "in-progress" | "done";

function dfsDetectCycles(
  startId: string,
  adj: Map<string, string[]>,
  state: Map<string, VisitState>,
  path: string[],
  cycles: string[][]
): void {
  state.set(startId, "in-progress");
  path.push(startId);

  for (const neighbour of adj.get(startId) ?? []) {
    if (state.get(neighbour) === "in-progress") {
      // Found a back-edge → extract the cycle
      const cycleStart = path.indexOf(neighbour);
      cycles.push([...path.slice(cycleStart), neighbour]);
    } else if (state.get(neighbour) !== "done") {
      dfsDetectCycles(neighbour, adj, state, path, cycles);
    }
  }

  path.pop();
  state.set(startId, "done");
}

// ─── Core: topological sort (Kahn's algorithm) ───────────────────────────────

function topologicalSort(adj: Map<string, string[]>): string[] {
  const inDegree = new Map<string, number>();

  for (const id of adj.keys()) inDegree.set(id, 0);
  for (const [, deps] of adj) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id);

  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const dep of adj.get(node) ?? []) {
      const next = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, next);
      if (next === 0) queue.push(dep);
    }
  }

  // If order doesn't include all nodes, a cycle prevented full traversal
  return order.length === adj.size ? order : [];
}

// ─── Main export: detectCycles ────────────────────────────────────────────────

/**
 * Detect all cycles in a dependency graph.
 *
 * @example
 * const tasks = [
 *   { id: "T1", dependsOn: [] },
 *   { id: "T2", dependsOn: ["T1"] },
 *   { id: "T3", dependsOn: ["T2", "T1"] },
 *   // Introduce a cycle:
 *   { id: "T4", dependsOn: ["T3"] },
 *   // T3 depends on T4 → cycle: T3 → T4 → T3
 * ];
 * // Add to T3: dependsOn: ["T2", "T1", "T4"]
 * const result = detectCycles(tasks);
 * // result.hasCycle === true
 * // result.cycles === [["T3", "T4", "T3"]]
 */
export function detectCycles(nodes: GraphNode[]): CycleDetectionResult {
  const adj = buildAdjacency(nodes);
  const state = new Map<string, VisitState>();
  for (const id of adj.keys()) state.set(id, "unvisited");

  const cycles: string[][] = [];

  for (const id of adj.keys()) {
    if (state.get(id) === "unvisited") {
      dfsDetectCycles(id, adj, state, [], cycles);
    }
  }

  // Deduplicate cycles (DFS can find the same cycle from different entry points)
  const seen = new Set<string>();
  const uniqueCycles = cycles.filter((cycle) => {
    const key = [...cycle].sort().join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const affectedNodes = new Set<string>();
  for (const cycle of uniqueCycles) {
    for (const id of cycle) affectedNodes.add(id);
  }

  const topologicalOrder =
    uniqueCycles.length === 0 ? topologicalSort(adj) : [];

  return {
    hasCycle: uniqueCycles.length > 0,
    cycles: uniqueCycles,
    affectedNodes,
    topologicalOrder,
  };
}

// ─── Helper: findBlockers ─────────────────────────────────────────────────────

/**
 * Given a set of nodes, return every node that is blocked and why.
 * A node is blocked if:
 *   - It is part of a cycle ("cycle")
 *   - One of its dependencies is itself blocked ("upstream_blocked")
 */
export function findBlockers(nodes: GraphNode[]): BlockerInfo[] {
  const { affectedNodes } = detectCycles(nodes);
  const adj = buildAdjacency(nodes);
  const blockers: BlockerInfo[] = [];

  // Propagate "upstream_blocked" via BFS from cycle nodes
  const allBlocked = new Set<string>(affectedNodes);
  const queue = [...affectedNodes];

  // Reverse map: who depends on X?
  const reverseDeps = new Map<string, string[]>();
  for (const [id, deps] of adj) {
    for (const dep of deps) {
      if (!reverseDeps.has(dep)) reverseDeps.set(dep, []);
      reverseDeps.get(dep)!.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dependent of reverseDeps.get(current) ?? []) {
      if (!allBlocked.has(dependent)) {
        allBlocked.add(dependent);
        queue.push(dependent);
      }
    }
  }

  for (const id of allBlocked) {
    const reason: BlockerInfo["reason"] = affectedNodes.has(id)
      ? "cycle"
      : "upstream_blocked";

    const blockedBy = (adj.get(id) ?? []).filter((dep) => allBlocked.has(dep));

    blockers.push({ nodeId: id, blockedBy, reason });
  }

  return blockers;
}

// ─── Helper: suggestFix ───────────────────────────────────────────────────────

/**
 * For each detected cycle, suggest the single edge to remove that breaks it.
 * Returns human-readable fix strings.
 */
export function suggestFixes(nodes: GraphNode[]): string[] {
  const { cycles } = detectCycles(nodes);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return cycles.map((cycle) => {
    // The last → first edge is the back-edge that closes the cycle
    const from = cycle[cycle.length - 2];
    const to = cycle[cycle.length - 1];
    const fromName = nodeMap.get(from)?.id ?? from;
    const toName = nodeMap.get(to)?.id ?? to;
    return (
      `Remove dependency "${fromName}" → "${toName}" ` +
      `or replace it with an async event/queue hand-off.`
    );
  });
}

// ─── Helper: validateBeforeSave ──────────────────────────────────────────────

/**
 * Drop-in guard for your save/update handlers.
 * Throws a descriptive error if adding `newDeps` to `nodeId` would create a cycle.
 *
 * @example
 * validateBeforeSave(allTasks, "T3", ["T4"]);
 * // throws: "Adding dependencies ["T4"] to T3 would create a cycle: T3 → T4 → T3"
 */
export function validateBeforeSave(
  nodes: GraphNode[],
  nodeId: string,
  newDeps: string[]
): void {
  // Apply the proposed change to a copy
  const draft = nodes.map((n) =>
    n.id === nodeId
      ? { ...n, dependsOn: [...(n.dependsOn ?? []), ...newDeps] }
      : n
  );

  const { hasCycle, cycles } = detectCycles(draft);

  if (hasCycle) {
    const relevant = cycles
      .filter((c) => c.includes(nodeId))
      .map((c) => c.join(" → "))
      .join("; ");

    throw new Error(
      `Adding dependencies [${newDeps.map((d) => `"${d}"`).join(", ")}] to "${nodeId}" ` +
        `would create a cycle: ${relevant}`
    );
  }
}
