// JSON-safe transport for calculation values. Tags wrap every value, so actual
// user strings or objects can never be mistaken for a special numeric value.
type Value =
  | { type: "undefined" | "null" | "empty" }
  | { type: "boolean"; value: boolean }
  | { type: "string"; value: string }
  | { type: "number"; value: number | "NaN" | "Infinity" | "-Infinity" | "-0" }
  | { type: "array"; value: Value[] }
  | { type: "object"; value: [string, Value][]; nullPrototype: boolean };
const version = "pureobom-preview-1";
const invalid = () =>
  Error(
    "계산 결과를 정확히 전달할 수 없습니다. / Invalid preview value transport.",
  );
function budget() {
  let nodes = 0,
    characters = 0;
  return (depth: number, text = "") => {
    characters += text.length;
    if (++nodes > 20000 || depth > 64 || characters > 250000)
      throw Error(
        "계산 값의 표시 한도를 넘었습니다. / Preview value limit exceeded.",
      );
  };
}
function encode(value: unknown): Value {
  const check = budget(),
    ancestors = new Set<object>();
  function visit(item: unknown, depth: number): Value {
    check(depth, typeof item === "string" ? item : "");
    if (item === undefined) return { type: "undefined" };
    if (item === null) return { type: "null" };
    if (typeof item === "boolean") return { type: "boolean", value: item };
    if (typeof item === "string") return { type: "string", value: item };
    if (typeof item === "number")
      return {
        type: "number",
        value: Object.is(item, -0)
          ? "-0"
          : Number.isFinite(item)
            ? item
            : (String(item) as "NaN" | "Infinity" | "-Infinity"),
      };
    if (typeof item !== "object" || ancestors.has(item)) throw invalid();
    const array = Array.isArray(item),
      proto = Object.getPrototypeOf(item);
    if (!array && proto !== null && proto !== Object.prototype) throw invalid();
    if (Object.getOwnPropertySymbols(item).length) throw invalid();
    ancestors.add(item);
    const read = (key: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !("value" in descriptor)) throw invalid();
      return visit(descriptor.value, depth + 1);
    };
    let result: Value;
    if (array) {
      if (
        item.length > 20000 ||
        Object.keys(item).some(
          (key) => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length,
        )
      )
        throw invalid();
      result = {
        type: "array",
        value: Array.from({ length: item.length }, (_, i) => {
          if (Object.hasOwn(item, i)) return read(String(i));
          check(depth + 1);
          return { type: "empty" };
        }),
      };
    } else
      result = {
        type: "object",
        nullPrototype: proto === null,
        value: Object.keys(item).map((key) => {
          check(depth + 1, key);
          return [key, read(key)];
        }),
      };
    ancestors.delete(item);
    return result;
  }
  return visit(value, 0);
}
export const usesPreviewTransport = (action: string) =>
  action === "simulate" || action === "compare";
export function encodePreviewMessage(value: unknown) {
  return { encoding: version, value: encode(value) };
}
export function decodePreviewMessage(message: unknown): unknown {
  const record = message as { encoding?: unknown; value?: unknown } | null;
  if (!record || record.encoding !== version) throw invalid();
  const check = budget();
  function visit(raw: unknown, depth: number): unknown {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid();
    const node = raw as {
      type?: unknown;
      value?: unknown;
      nullPrototype?: unknown;
    };
    check(
      depth,
      node.type === "string" && typeof node.value === "string"
        ? node.value
        : "",
    );
    if (node.type === "undefined") return undefined;
    if (node.type === "null") return null;
    if (node.type === "boolean" && typeof node.value === "boolean")
      return node.value;
    if (node.type === "string" && typeof node.value === "string") {
      return node.value;
    }
    if (node.type === "number") {
      if (typeof node.value === "number" && Number.isFinite(node.value))
        return node.value;
      if (node.value === "NaN") return NaN;
      if (node.value === "Infinity") return Infinity;
      if (node.value === "-Infinity") return -Infinity;
      if (node.value === "-0") return -0;
      throw invalid();
    }
    if (!Array.isArray(node.value) || node.value.length > 20000)
      throw invalid();
    if (node.type === "array") {
      const out = new Array(node.value.length);
      node.value.forEach((child, i) => {
        if (child && typeof child === "object" && child.type === "empty")
          check(depth + 1);
        else out[i] = visit(child, depth + 1);
      });
      return out;
    }
    if (node.type === "object") {
      if (typeof node.nullPrototype !== "boolean") throw invalid();
      const out: Record<string, unknown> = Object.create(
        node.nullPrototype ? null : Object.prototype,
      );
      for (const entry of node.value) {
        if (
          !Array.isArray(entry) ||
          entry.length !== 2 ||
          typeof entry[0] !== "string" ||
          Object.hasOwn(out, entry[0])
        )
          throw invalid();
        check(depth + 1, entry[0]);
        Object.defineProperty(out, entry[0], {
          value: visit(entry[1], depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return out;
    }
    throw invalid();
  }
  return visit(record.value, 0);
}
export function displayValue(value: unknown): string {
  function format(node: Value): string {
    switch (node.type) {
      case "undefined":
        return "undefined";
      case "null":
        return "null";
      case "empty":
        return "<empty>";
      case "boolean":
        return String(node.value);
      case "number":
        return String(node.value);
      case "string":
        return JSON.stringify(node.value);
      case "array":
        return `[${node.value.map(format).join(", ")}]`;
      case "object":
        return `{${node.value.map(([key, item]) => `${JSON.stringify(key)}: ${format(item)}`).join(", ")}}`;
    }
  }
  return format(encode(value));
}
export function specialValueKinds(value: unknown): string[] {
  const kinds = new Set<string>();
  function visit(node: Value) {
    if (node.type === "undefined" || node.type === "empty")
      kinds.add(node.type);
    else if (node.type === "number" && typeof node.value === "string")
      kinds.add(node.value);
    else if (node.type === "array") node.value.forEach(visit);
    else if (node.type === "object")
      node.value.forEach(([, item]) => visit(item));
  }
  visit(encode(value));
  return [...kinds];
}
