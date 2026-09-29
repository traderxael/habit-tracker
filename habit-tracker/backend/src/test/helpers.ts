import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

const dir = mkdtempSync(path.join(tmpdir(), "ht-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { createApp } = await import("../app.js");
const { initSchema } = await import("../db.js");
await initSchema();

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
