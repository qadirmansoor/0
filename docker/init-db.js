const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { seedDatabase } = require("./seed");

const DATA_DIR = process.env.DATA_DIR || "/data";
const APP_DB = "erp";
const APP_USER = "erp";
const configPath = path.join(DATA_DIR, "config.json");
const runtimeEnvPath = path.join(DATA_DIR, "runtime.env");
const migrationsDir = process.env.MIGRATIONS_DIR || path.join(__dirname, "migrations");

function readAllMigrationsSql() {
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs
    .map((dir) => fs.readFileSync(path.join(migrationsDir, dir, "migration.sql"), "utf8"))
    .join("\n\n");
}

function loadOrCreateConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  const config = {
    nextAuthSecret: crypto.randomBytes(32).toString("hex"),
    dbPassword: crypto.randomBytes(16).toString("hex"),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return config;
}

async function main() {
  const config = loadOrCreateConfig();

  const admin = new Client({ host: "127.0.0.1", port: 5432, user: "postgres", database: "postgres" });
  await admin.connect();

  const { rows: roleRows } = await admin.query("select 1 from pg_roles where rolname=$1", [APP_USER]);
  if (roleRows.length === 0) {
    await admin.query(`create role "${APP_USER}" login password '${config.dbPassword}'`);
  } else {
    await admin.query(`alter role "${APP_USER}" password '${config.dbPassword}'`);
  }

  const { rows: dbRows } = await admin.query("select 1 from pg_database where datname=$1", [APP_DB]);
  if (dbRows.length === 0) {
    await admin.query(`create database "${APP_DB}" owner "${APP_USER}"`);
  }
  await admin.end();

  const databaseUrl = `postgresql://${APP_USER}:${config.dbPassword}@127.0.0.1:5432/${APP_DB}?schema=public`;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(`select to_regclass('public."Account"') as exists`);
    if (!rows[0].exists) {
      console.log("[init-db] Applying schema...");
      await client.query(readAllMigrationsSql());
      console.log("[init-db] Seeding initial data...");
      await seedDatabase(client);
      console.log("[init-db] Schema and seed complete.");
    } else {
      console.log("[init-db] Existing database detected, skipping schema/seed.");
    }
  } finally {
    await client.end();
  }

  fs.writeFileSync(
    runtimeEnvPath,
    `DATABASE_URL=${databaseUrl}\nNEXTAUTH_SECRET=${config.nextAuthSecret}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
