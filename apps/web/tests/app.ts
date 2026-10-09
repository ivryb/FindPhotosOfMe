import { startBackend } from "./backend";

/** Starts the fixture backend and a Nuxt dev server on `port` that talks to it. Call `stop` when the file's tests end. */
export async function startApp(port: number, { canonicalOrigin = "" } = {}) {
  const origin = `http://localhost:${port}`;
  // The readiness check below accepts any server on the port, so tests would otherwise run against a stray one.
  if (await fetch(origin).then(() => true, () => false)) throw new Error(`Port ${port} is already in use; stop that server first`);
  const backend = startBackend();
  const log = `/tmp/findphotos-tests-${port}.log`;
  const server = Bun.spawn(["bun", "x", "nuxt", "dev", "tests", "--port", String(port), "--dotenv", "/dev/null"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...withoutNuxtSettings(process.env), NUXT_PUBLIC_ORIGIN: canonicalOrigin, TEST_BACKEND_URL: backend.url.href.replace(/\/$/, "") },
    stdout: Bun.file(log),
    stderr: Bun.file(log),
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${origin}/sign-in`);
      if (response.ok) return { origin, backendOrigin: backend.url.origin, stop: () => { server.kill(); backend.stop(true); } };
    } catch {}
    await Bun.sleep(500);
  }
  server.kill();
  backend.stop(true);
  throw new Error(`Nuxt did not start; see ${log}`);
}

// Bun loads apps/web/.env into the test process; its NUXT_* values would point the app at real services.
function withoutNuxtSettings(env: typeof process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith("NUXT_")));
}
