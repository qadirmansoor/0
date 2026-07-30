const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const electronApp = path.join(__dirname, "..");
const resources = path.join(electronApp, "resources");
const appDir = path.join(resources, "app");

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log("Cleaning resources...");
rmrf(resources);
fs.mkdirSync(resources, { recursive: true });

const standaloneDir = path.join(root, ".next", "standalone");
if (!fs.existsSync(standaloneDir)) {
  console.error(
    "Missing .next/standalone. Run `npm run build` in the project root first (next.config.ts must set output: 'standalone')."
  );
  process.exit(1);
}

console.log("Copying Next.js standalone server...");
copyDir(standaloneDir, appDir);

// Next's standalone output copies the root-level .env used at build time.
// Never ship that: the desktop app supplies its own DATABASE_URL / secrets at runtime.
const leakedEnv = path.join(appDir, ".env");
if (fs.existsSync(leakedEnv)) {
  fs.rmSync(leakedEnv);
  console.log("Removed bundled .env from standalone output.");
}

console.log("Copying static assets...");
copyDir(path.join(root, ".next", "static"), path.join(appDir, ".next", "static"));

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  console.log("Copying public assets...");
  copyDir(publicDir, path.join(appDir, "public"));
}

console.log("Concatenating Prisma migrations...");
const migrationsRoot = path.join(root, "prisma", "migrations");
const migrationDirs = fs
  .readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const sql = migrationDirs
  .map((dir) => fs.readFileSync(path.join(migrationsRoot, dir, "migration.sql"), "utf8"))
  .join("\n\n");

fs.writeFileSync(path.join(resources, "migrations.sql"), sql);

console.log(`Done. ${migrationDirs.length} migration file(s) bundled.`);
