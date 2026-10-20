import type { FunctionInfo } from "./types";

/** Source containment only: this does not establish calls or execution order. */
export function functionNesting(functions: FunctionInfo[], selectedId: string) {
  const selected = functions.find((fn) => fn.id === selectedId);
  if (!selected) return { parent: undefined, children: [] as FunctionInfo[] };
  const contains = (outer: FunctionInfo, inner: FunctionInfo) =>
    outer.id !== inner.id &&
    outer.start <= inner.start &&
    inner.end <= outer.end &&
    (outer.start < inner.start || inner.end < outer.end);
  const parent = functions
    .filter((fn) => contains(fn, selected))
    .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
  const nested = functions
    .filter((fn) => contains(selected, fn))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const children: FunctionInfo[] = [];
  for (const candidate of nested) {
    if (!children.some((outer) => contains(outer, candidate)))
      children.push(candidate);
  }
  return { parent, children };
}
