import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, cp, mkdtemp, readdir, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const apiDist = path.join(root, "artifacts/api-server/dist");
const webDist = path.join(root, "artifacts/atlas/dist/public");
await access(path.join(webDist, "index.html"));
await access(path.join(apiDist, "index.mjs"));
const files = await readdir(apiDist);
assert.ok(!files.some(name => name.endsWith(".map") || name.startsWith("pino-pretty")),
  "Build API with NODE_ENV=production before running the package check.");

// Never kill or compete with a running managed API workflow.
const reservation = net.createServer();
try {
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen({ port: 8080, host: "0.0.0.0" }, resolve);
  });
} catch {
  throw new Error("Port 8080 is occupied. Stop the managed API workflow before checking the production package.");
} finally {
  if (reservation.listening) await new Promise(resolve => reservation.close(resolve));
}

const payload = await mkdtemp(path.join(os.tmpdir(), "atlas-production-"));
let child;
let exited;
try {
  await cp(apiDist, path.join(payload, "artifacts/api-server/dist"), { recursive: true });
  await cp(webDist, path.join(payload, "artifacts/atlas/dist/public"), { recursive: true });
  // No node_modules, repo sources, psql, Python, pnpm or shell commands available
  // to the child. env inherits secrets without reading or printing their values.
  child = spawn("env", [
    "NODE_ENV=production", "PORT=8080", "PATH=/atlas-no-cli", "NODE_PATH=",
    process.execPath, path.join(payload, "artifacts/api-server/dist/index.mjs"),
  ], { cwd: payload, stdio: ["ignore", "ignore", "ignore"] });
  exited = once(child, "exit");
  const base = "http://127.0.0.1:8080";
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error("Isolated production Node process failed to start.");
    try {
      const res = await fetch(base + "/api/healthz", { signal: AbortSignal.timeout(500) });
      if (res.status === 200 && (await res.json()).status === "ok") { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Production health endpoint did not return 200.");
  for (const route of ["/", "/ayarlar", "/sohbetler"]) {
    const res = await fetch(base + route);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<div id="root"/);
  }
  const html = await (await fetch(base + "/")).text();
  const scriptUrl = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(scriptUrl, "Built frontend entry asset is missing.");
  const asset = await fetch(base + scriptUrl);
  assert.equal(asset.status, 200);
  await asset.body?.cancel();
  const missingApi = await fetch(base + "/api/does-not-exist");
  assert.equal(missingApi.status, 404);
  assert.match(missingApi.headers.get("content-type"), /application\/json/);
  await missingApi.body?.cancel();
  const missingAsset = await fetch(base + "/assets/does-not-exist.js");
  assert.equal(missingAsset.status, 404);
  await missingAsset.body?.cancel();
  console.log("PASS: isolated Node-only package; port 8080; health/web/SPA/assets; API 404.");
  child.kill("SIGTERM");
  const [code, signal] = await Promise.race([
    exited,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Shutdown timed out")), 10000).unref()),
  ]);
  assert.equal(code, 0);
  assert.equal(signal, null);
  console.log("PASS: graceful shutdown, no runtime compilation or PostgreSQL CLI.");
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
  await rm(payload, { recursive: true, force: true });
}
