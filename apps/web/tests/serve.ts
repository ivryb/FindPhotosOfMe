// Runs the app against the test fixtures for looking at pages by hand: `bun tests/serve.ts`, then open
// http://localhost:3215/search?subdomain=itarena. Stop it with Ctrl-C.
import { startApp } from "./app";

const app = await startApp(3215);
console.log(`Fixture app at ${app.origin}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { app.stop(); process.exit(0); });
