#!/usr/bin/env node
/**
 * Builds the official Excalidraw MCP server from server/vendor/excalidraw-mcp.
 * Clone source: https://github.com/excalidraw/excalidraw-mcp
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const warnOnly = process.argv.includes("--warn-only");

const VENDOR_DIR = path.join(__dirname, "..", "vendor", "excalidraw-mcp");
const ENTRY = path.join(VENDOR_DIR, "dist", "index.js");

function run(cmd, cwd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit", env: process.env });
}

function ensureClone() {
  if (fs.existsSync(path.join(VENDOR_DIR, "package.json"))) {
    return;
  }

  console.log("Cloning excalidraw-mcp into vendor/...");
  fs.mkdirSync(path.dirname(VENDOR_DIR), { recursive: true });
  run(
    "git clone --depth 1 --branch v0.3.2 https://github.com/excalidraw/excalidraw-mcp.git excalidraw-mcp",
    path.dirname(VENDOR_DIR)
  );
}

if (fs.existsSync(ENTRY)) {
  console.log(`Excalidraw MCP already built at ${ENTRY}`);
  process.exit(0);
}

try {
  ensureClone();

  // Prevent Vite from picking up the monorepo root PostCSS/Tailwind config
  fs.writeFileSync(
    path.join(VENDOR_DIR, "postcss.config.mjs"),
    "export default { plugins: {} };\n"
  );

  console.log(`Building Excalidraw MCP in ${VENDOR_DIR}...`);

  if (fs.existsSync(path.join(VENDOR_DIR, "pnpm-lock.yaml"))) {
    try {
      run("pnpm install --frozen-lockfile", VENDOR_DIR);
    } catch {
      run("pnpm install", VENDOR_DIR);
    }
  } else {
    run("npm install", VENDOR_DIR);
  }

  const bun = path.join(VENDOR_DIR, "node_modules", ".bin", "bun");
  const bunCmd = process.platform === "win32" ? `"${bun}.exe"` : bun;

  run("npx tsc --noEmit -p tsconfig.json", VENDOR_DIR);
  run("npx cross-env INPUT=src/mcp-app.html vite build", VENDOR_DIR);

  const htmlSrc = path.join(VENDOR_DIR, "dist", "src", "mcp-app.html");
  const htmlDest = path.join(VENDOR_DIR, "dist", "mcp-app.html");
  fs.renameSync(htmlSrc, htmlDest);
  fs.rmSync(path.join(VENDOR_DIR, "dist", "src"), { recursive: true, force: true });

  run("npx tsc -p tsconfig.server.json", VENDOR_DIR);
  run(`${bunCmd} build src/server.ts --outdir dist --target node`, VENDOR_DIR);
  run(
    `${bunCmd} build src/main.ts --outfile dist/index.js --target node --banner "#!/usr/bin/env node"`,
    VENDOR_DIR
  );
} catch (error) {
  const msg = `Excalidraw MCP build error: ${error instanceof Error ? error.message : error}`;
  if (warnOnly) {
    console.warn(msg);
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(ENTRY)) {
  const msg = `Build failed: ${ENTRY} not found`;
  if (warnOnly) {
    console.warn(msg);
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}

console.log(`Excalidraw MCP built successfully: ${ENTRY}`);
