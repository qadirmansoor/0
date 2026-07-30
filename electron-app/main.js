const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");
const EmbeddedPostgres = require("embedded-postgres").default;
const { Client } = require("pg");
const { seedDatabase } = require("./seed");

const isDev = !app.isPackaged;
const resourcesPath = isDev ? path.join(__dirname, "resources") : process.resourcesPath;
const appResourcesDir = path.join(resourcesPath, "app");
const migrationsSqlPath = path.join(resourcesPath, "migrations.sql");

const userDataDir = app.getPath("userData");
const pgDataDir = path.join(userDataDir, "pgdata");
const configPath = path.join(userDataDir, "desktop-config.json");

const PG_PORT = 55432;
const NEXT_PORT = 4173;
const DB_NAME = "erp";
const DB_USER = "erp";

let pg = null;
let nextProcess = null;
let mainWindow = null;
let isQuitting = false;

function log(...args) {
  console.log("[erp-desktop]", ...args);
}

function loadOrCreateConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  fs.mkdirSync(userDataDir, { recursive: true });
  const config = {
    nextAuthSecret: crypto.randomBytes(32).toString("hex"),
    dbPassword: crypto.randomBytes(16).toString("hex"),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return config;
}

async function startDatabase(config) {
  fs.mkdirSync(pgDataDir, { recursive: true });

  const runningAsRoot =
    process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0;

  pg = new EmbeddedPostgres({
    databaseDir: pgDataDir,
    user: DB_USER,
    password: config.dbPassword,
    port: PG_PORT,
    persistent: true,
    createPostgresUser: runningAsRoot,
    // Don't rely on the system temp dir for the unix socket: it may not be writable
    // (sandboxed/locked-down environments), and Windows has no unix sockets anyway
    // so this flag is simply ignored there — we always connect over TCP regardless.
    postgresFlags: [`--unix_socket_directories=${pgDataDir}`],
    onLog: (msg) => log("[postgres]", msg),
    onError: (msg) => console.error("[postgres]", msg),
  });

  const isFreshCluster = !fs.existsSync(path.join(pgDataDir, "PG_VERSION"));
  if (isFreshCluster) {
    log("Initialising new local Postgres cluster...");
    await pg.initialise();
  }

  log("Starting local Postgres...");
  await pg.start();

  try {
    await pg.createDatabase(DB_NAME);
  } catch {
    // database already exists — fine
  }

  return `postgresql://${DB_USER}:${config.dbPassword}@127.0.0.1:${PG_PORT}/${DB_NAME}?schema=public`;
}

async function ensureSchemaAndSeed(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(`select to_regclass('public."Account"') as exists`);
    if (!rows[0].exists) {
      log("Applying database schema...");
      const sql = fs.readFileSync(migrationsSqlPath, "utf8");
      await client.query(sql);
      log("Seeding initial data...");
      await seedDatabase(client);
      log("Schema and seed complete.");
    } else {
      log("Existing database detected, skipping schema/seed.");
    }
  } finally {
    await client.end();
  }
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error("Timed out waiting for the app server to start."));
        } else {
          setTimeout(attempt, 300);
        }
      });
    };
    attempt();
  });
}

function startNextServer(databaseUrl, config) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(NEXT_PORT),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      NEXTAUTH_SECRET: config.nextAuthSecret,
      NEXTAUTH_URL: `http://127.0.0.1:${NEXT_PORT}`,
    };

    nextProcess = spawn(process.execPath, [path.join(appResourcesDir, "server.js")], {
      env,
      cwd: appResourcesDir,
      stdio: "pipe",
    });

    nextProcess.stdout.on("data", (d) => log("[server]", d.toString().trim()));
    nextProcess.stderr.on("data", (d) => console.error("[server]", d.toString().trim()));
    nextProcess.on("exit", (code) => {
      if (!isQuitting) {
        console.error("App server exited unexpectedly with code", code);
      }
    });
    nextProcess.on("error", reject);

    waitForServer(`http://127.0.0.1:${NEXT_PORT}`, 45000).then(resolve).catch(reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${NEXT_PORT}`);
}

app.whenReady().then(async () => {
  try {
    const config = loadOrCreateConfig();
    const databaseUrl = await startDatabase(config);
    await ensureSchemaAndSeed(databaseUrl);
    await startNextServer(databaseUrl, config);
    createWindow();
  } catch (err) {
    console.error(err);
    dialog.showErrorBox("ERP failed to start", String((err && err.stack) || err));
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

async function shutdown() {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
  if (pg) {
    try {
      await pg.stop();
    } catch (err) {
      console.error("Error stopping Postgres:", err);
    }
    pg = null;
  }
}

app.on("will-quit", async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  await shutdown();
  app.quit();
});
