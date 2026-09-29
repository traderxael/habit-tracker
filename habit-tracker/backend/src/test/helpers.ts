import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "ht-test-")), "test.sqlite");
process.env.NODE_ENV = "test";

const { createApp } = await import("../app.js");

export const app = createApp();

const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
server.unref();
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

export interface Ctx {
  app: ReturnType<typeof createApp>;
  token: string;
  auth: string;
}

let seq = 0;

export async function createCtx(): Promise<Ctx> {
  const email = `t${Date.now()}_${seq++}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "secret123" }),
  });
  if (!res.ok) throw new Error(`register falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  return { app, token: data.token, auth: `Bearer ${data.token}` };
}
