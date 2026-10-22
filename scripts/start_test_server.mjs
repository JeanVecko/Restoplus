import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { URL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const appRaw = process.env.APP_DATABASE_URL;
if (!appRaw) throw new Error("APP_DATABASE_URL absent");

const appParsed = new URL(appRaw);
appParsed.pathname = "/restoplus_test_disposable";
const testAppUrl = appParsed.toString();

const authParsed = new URL(appRaw);
authParsed.username = "restoplus_auth";
authParsed.pathname = "/restoplus_test_disposable";
const testAuthUrl = authParsed.toString();

const env = {
  ...process.env,
  PORT: "3000",
  APP_DATABASE_URL: testAppUrl,
  AUTH_DATABASE_URL: testAuthUrl,
};

console.log("Démarrage de Next.js dev server lié exclusivement à restoplus_test_disposable sur le port 3000...");
const child = spawn("npx", ["next", "dev", "-p", "3000", "--webpack"], {
  cwd: process.cwd(),
  env,
  shell: true,
  stdio: "inherit",
});

child.on("exit", (code) => {
  console.log("Serveur Next.js arrêté avec le code", code);
  process.exit(code ?? 0);
});
