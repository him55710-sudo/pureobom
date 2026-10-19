import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { OllamaClient, OllamaRequestError } from "../extension/src/ollama";
import type { LocalAIPhase } from "../src/core/localAIProgress";
import type { AssistantInput } from "../src/core/localAssistant";

const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    await new Promise<void>((r) => s.close(() => r()));
  }
});
async function server(
  handler: (req: IncomingMessage, res: ServerResponse, body: any) => void,
) {
  const s = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    handler(req, res, raw ? JSON.parse(raw) : undefined);
  });
  servers.push(s);
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  return (s.address() as AddressInfo).port;
}
const input: AssistantInput = {
  source: "fee = 3000\n",
  language: "python",
  lang: "ko",
  task: "explain",
  instruction: "",
};
const model = {
  name: "local:3b",
  digest: "a".repeat(64),
  size: 1900000000,
  details: { format: "gguf" },
};
function reply(res: ServerResponse, value: unknown) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}
function fixture(path: string | undefined) {
  if (path === "/api/status") return { cloud: { disabled: true } };
  if (path === "/api/tags") return { models: [model] };
  if (path === "/api/show")
    return {
      details: { format: "gguf" },
      model_info: { "general.architecture": "qwen2" },
      capabilities: ["completion"],
    };
  return {
    done: true,
    done_reason: "stop",
    message: {
      content: JSON.stringify({
        summary: "배송비",
        citations: [{ quote: "fee = 3000", explanation: "값" }],
        inputChecks: "입력 검사가 없습니다.",
        callerRequirements: "사용처의 조건은 알 수 없습니다.",
        examples: [],
      }),
    },
  };
}
describe("Ollama loopback protocol (controlled HTTP fixture, not real inference)", () => {
  it("checks local-only mode and model metadata before sending only the explicit file", async () => {
    const seen: { route?: string; body: any }[] = [];
    const port = await server((req, res, body) => {
      seen.push({ route: req.url, body });
      reply(res, fixture(req.url));
    });
    const phases: LocalAIPhase[] = [];
    const result = await new OllamaClient(port).generate(
      model.name,
      input,
      undefined,
      (phase) => phases.push(phase),
    );
    expect(phases).toEqual([
      "connection",
      "models",
      "model",
      "connection",
      "generation",
      "validation",
    ]);
    expect(seen.map((s) => s.route)).toEqual([
      "/api/status",
      "/api/tags",
      "/api/show",
      "/api/status",
      "/api/chat",
    ]);
    expect(result.proposal.citations[0].line).toBe(1);
    const chat = seen.at(-1)!.body;
    expect(JSON.parse(chat.messages[1].content).source).toBe(input.source);
    expect(chat).not.toHaveProperty("tools");
    expect(chat).not.toHaveProperty("api_key");
    expect(chat.stream).toBe(false);
    expect(chat.truncate).toBe(false);
    expect(chat.shift).toBe(false);
    expect(chat.options).not.toHaveProperty("num_gpu");
    expect(result.processor).toBe("auto");
    expect(result.timeoutMs).toBe(180000);
    expect(chat.options.num_ctx).toBeLessThan(32768);
    expect(result.contextSize).toBe(chat.options.num_ctx);
  });
  it("requests CPU only when explicitly selected and rejects invalid hardware choices", async () => {
    let chat: any;
    const port = await server((req, res, body) => {
      if (req.url === "/api/chat") chat = body;
      reply(res, fixture(req.url));
    });
    const result = await new OllamaClient(port, undefined, "cpu").generate(
      model.name,
      input,
    );
    expect(chat.options.num_gpu).toBe(0);
    expect(result.processor).toBe("cpu");
    for (const bad of ["gpu", "", 1, null])
      expect(() => new OllamaClient(port, undefined, bad as "cpu")).toThrow(
        /inference processor/,
      );
  });
  it("rejects enabled cloud before source transmission", async () => {
    const seen: string[] = [];
    const port = await server((req, res) => {
      seen.push(req.url!);
      reply(res, { cloud: { disabled: false } });
    });
    await expect(
      new OllamaClient(port).generate(model.name, input),
    ).rejects.toThrow(/OLLAMA_NO_CLOUD/);
    expect(seen).toEqual(["/api/status"]);
  });
  it("requests direct answers only when the model advertises a supported off switch", async () => {
    for (const thinking of [
      { values: [false, true], default: true },
      { values: ["low", "medium", "high"], default: "medium" },
      { values: [true], default: true },
      undefined,
    ]) {
      let chat: any;
      const port = await server((req, res, body) => {
        if (req.url === "/api/chat") chat = body;
        reply(
          res,
          req.url === "/api/show"
            ? { ...fixture(req.url), thinking }
            : fixture(req.url),
        );
      });
      await new OllamaClient(port).generate(model.name, input);
      if (thinking?.values.some((value) => value === false))
        expect(chat.think).toBe(false);
      else expect(chat).not.toHaveProperty("think");
      expect(chat.options.num_predict).toBe(4096);
    }
  });
  it("filters cloud aliases and rejects remote metadata before chat", async () => {
    let chat = false;
    const port = await server((req, res) => {
      if (req.url === "/api/chat") chat = true;
      reply(
        res,
        req.url === "/api/tags"
          ? {
              models: [
                model,
                { ...model, name: "x:cloud" },
                { ...model, name: "alias", remote_host: "https://ollama.com" },
              ],
            }
          : req.url === "/api/show"
            ? { ...fixture(req.url), remote_model: "upstream" }
            : fixture(req.url),
      );
    });
    expect(await new OllamaClient(port).models()).toEqual([
      { name: model.name, digest: model.digest, size: model.size },
    ]);
    await expect(
      new OllamaClient(port).generate(model.name, input),
    ).rejects.toThrow(/local text model/);
    expect(chat).toBe(false);
  });
  it("does not follow redirects", async () => {
    const port = await server((_req, res) => {
      res.writeHead(302, { Location: "http://example.com/" });
      res.end();
    });
    await expect(new OllamaClient(port).models()).rejects.toThrow(/302/);
  });
  it("handles cancellation, timeout and oversized responses", async () => {
    const port = await server((req, res) => {
      if (req.url !== "/api/chat") reply(res, fixture(req.url));
    });
    const controller = new AbortController();
    const pending = new OllamaClient(port).generate(
      model.name,
      input,
      controller.signal,
    );
    setTimeout(() => controller.abort(), 30);
    await expect(pending).rejects.toThrow(/cancelled/);
    await expect(
      new OllamaClient(port, 30).generate(model.name, input),
    ).rejects.toMatchObject({
      name: "OllamaRequestError",
      phase: "generation",
      reason: "timeout",
      timeoutMs: 30,
    });
    const big = await server((_req, res) =>
      res.end(" ".repeat(2 * 1024 * 1024 + 1)),
    );
    await expect(new OllamaClient(big).models()).rejects.toThrow(/2MB/);
  });
  it("uses an explicitly selected bounded deadline and leaves the default unchanged", async () => {
    const port = await server((req, res) => reply(res, fixture(req.url)));
    expect(
      (await new OllamaClient(port, 300000).generate(model.name, input))
        .timeoutMs,
    ).toBe(300000);
    for (const timeout of [0, -1, 1.5, NaN, Infinity, 600001])
      expect(() => new OllamaClient(port, timeout)).toThrow(/time limit/);
  });
  it("rejects partial or tool-bearing completions", async () => {
    const port = await server((req, res) =>
      reply(
        res,
        req.url === "/api/chat"
          ? { ...fixture(req.url), done_reason: "length" }
          : fixture(req.url),
      ),
    );
    await expect(
      new OllamaClient(port).generate(model.name, input),
    ).rejects.toThrow(/Incomplete/);
  });
  it("identifies a preflight timeout without claiming model generation or sending source", async () => {
    const seen: string[] = [],
      phases: LocalAIPhase[] = [];
    const port = await server((req) => {
      seen.push(req.url!);
    });
    await expect(
      new OllamaClient(port).generate(model.name, input, undefined, (phase) =>
        phases.push(phase),
      ),
    ).rejects.toMatchObject({
      name: "OllamaRequestError",
      phase: "connection",
      reason: "timeout",
      timeoutMs: 5000,
    });
    expect(phases).toEqual(["connection"]);
    expect(seen).toEqual(["/api/status"]);
  }, 15000);
  it("keeps the failing network stage and allows cancellation before chat transmission", async () => {
    for (const [route, phase] of [
      ["/api/tags", "models"],
      ["/api/show", "model"],
      ["/api/chat", "generation"],
    ]) {
      const port = await server((req, res) => {
        if (req.url === route) {
          res.writeHead(503);
          res.end();
        } else reply(res, fixture(req.url));
      });
      try {
        await new OllamaClient(port).generate(model.name, input);
        throw Error("Expected HTTP failure");
      } catch (error) {
        expect(error).toBeInstanceOf(OllamaRequestError);
        expect(error).toMatchObject({ phase, reason: "request" });
        expect((error as Error).message).toContain("503");
      }
    }
    const seen: string[] = [];
    const port = await server((req, res) => {
      seen.push(req.url!);
      reply(res, fixture(req.url));
    });
    const cancel = new AbortController();
    await expect(
      new OllamaClient(port).generate(
        model.name,
        input,
        cancel.signal,
        (phase) => {
          if (phase === "generation") cancel.abort();
        },
      ),
    ).rejects.toThrow(/cancelled/);
    expect(seen).not.toContain("/api/chat");
  });
});
