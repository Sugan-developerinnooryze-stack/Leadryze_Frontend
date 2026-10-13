import type { FlowNode, FlowEdge } from '../../../modules/native-crm/queries/automation-flows.queries';
import { NODE_META } from './flow-node-visuals';

/** Walks the flow's PRIMARY path from its trigger — at each fork, prefers
 * the untagged edge, else 'true'/'success'/'approve' (the "happy path"
 * port), matching how a reader would mentally trace "what does this flow
 * basically do." Not a full graph walk (a card-sized strip has no room for
 * branches anyway) — `hasMore` on the caller side signals there's more than
 * what's shown. */
function buildChainSequence(nodes: FlowNode[], edges: FlowEdge[], max = 6): FlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const trigger = nodes.find((n) => n.type === 'trigger');
  if (!trigger) return nodes.slice(0, max);

  const seq: FlowNode[] = [trigger];
  const visited = new Set([trigger.id]);
  let current = trigger;
  while (seq.length < max) {
    const outs = edges.filter((e) => e.from === current.id);
    const next =
      outs.find((e) => e.fromPort === undefined) ??
      outs.find((e) => e.fromPort === 'true') ??
      outs.find((e) => e.fromPort === 'success') ??
      outs.find((e) => e.fromPort === 'approve') ??
      outs[0];
    if (!next || visited.has(next.to)) break;
    const node = byId.get(next.to);
    if (!node) break;
    seq.push(node);
    visited.add(node.id);
    current = node;
  }
  return seq;
}

/** Compact node-sequence strip — icons in order, e.g. ⚡ → ◇ → 💬 → 🕐 → ✉ —
 * for automation list/template cards, reusing the exact same icon/color
 * tokens the builder canvas and execution diagrams already use (NODE_META),
 * so a node reads identically everywhere in the app. */
export default function ChainPreview({ nodes, edges, className }: { nodes: FlowNode[]; edges: FlowEdge[]; className?: string }) {
  if (nodes.length === 0) return null;
  const seq = buildChainSequence(nodes, edges);
  const hiddenCount = nodes.length - seq.length;

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className ?? ''}`}>
      {seq.map((n, i) => {
        const meta = NODE_META[n.type];
        const Icon = meta.icon;
        return (
          <span key={n.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-text-muted text-[9px]">→</span>}
            <span className={`inline-flex items-center justify-center h-5 w-5 rounded ${meta.bg}`} title={meta.label}>
              <Icon className={`h-3 w-3 ${meta.color}`} />
            </span>
          </span>
        );
      })}
      {hiddenCount > 0 && <span className="text-[9px] text-text-muted ml-0.5">+{hiddenCount}</span>}
    </div>
  );
}
