# ERP Desktop (Windows)

Wraps the ERP web app in Electron with a bundled, embedded PostgreSQL
database, so it runs as a self-contained Windows desktop app — no
separate Postgres install, no Node install, nothing but the `.exe`.

## How it works

- On first launch, the app initializes a local Postgres cluster inside
  the OS user-data folder (`%APPDATA%\ERP\pgdata` on Windows), applies
  the database schema, and seeds it with the standard chart of
  accounts, a demo warehouse/items, and an admin login
  (`admin@erp.local` / `admin123`).
- On every launch, it starts that local Postgres, starts the Next.js
  server (built with `output: "standalone"`) pointed at it, and opens
  a window loading `http://127.0.0.1:4173`.
- Data persists across restarts in the user-data folder. Uninstalling
  the app does not delete that folder — remove it manually to fully
  reset.
- A per-install `NEXTAUTH_SECRET` and DB password are generated once
  and stored alongside the data (`desktop-config.json`), so the login
  session survives restarts.

## Building the Windows installer

From the **project root** (not this folder):

```bash
npm run build          # requires next.config.ts: output: "standalone"
```

Then, from `electron-app/`:

```bash
npm install
npm run dist:win        # -> dist/ERP Setup <version>.exe
```

`dist:win` runs `scripts/prepare-resources.js` first, which copies
`.next/standalone`, `.next/static`, `public/`, and the concatenated
Prisma migration SQL into `electron-app/resources/`, then invokes
`electron-builder --win --x64`.

### Cross-compiling from Linux

This was built and packaged from a Linux container, which needs a few
things a normal Linux dev box won't have out of the box:

- **Wine** (`wine`, `wine32:i386` with multiarch enabled) — required
  for `electron-builder`'s `rcedit` step, which embeds the icon and
  version metadata into the Windows `.exe`. Without it, packaging
  fails on the resource-editing step.
- **The Windows Postgres binaries**, since npm only installs the
  platform package matching the *host* OS by default:

  ```bash
  npm install @embedded-postgres/windows-x64@<version> --force --os=win32 --cpu=x64 --no-save
  ```

  (`--force` is required — npm's `--os`/`--cpu` override flags don't
  bypass the optionalDependency platform check on their own.)

On a native Windows CI runner (e.g. GitHub Actions `windows-latest`),
none of this is necessary — `npm install && npm run dist:win` should
just work, and it'll pick up the right platform packages automatically.

## What was and wasn't verified

Built and packaging-verified from this Linux container:

- Next.js standalone build is fully self-contained (Prisma's driver
  adapter got inlined by the bundler — no native query-engine binaries
  needed at all).
- The full runtime logic (embedded Postgres init → schema → seed →
  Next server → login → data pages) was smoke-tested end-to-end on
  **Linux** (via the `linux-x64` embedded-postgres binaries, under
  Xvfb), including a fresh-DB first run and a restart against an
  existing DB.
- `electron-builder` produced a valid, well-formed Windows PE32/NSIS
  installer (`ERP Setup 1.0.0.exe`) with no errors, using the
  `windows-x64` embedded-postgres binaries and Wine for the Windows
  resource-editing step.

**Not verified: actually running the installed app on real Windows.**
This container has no Windows machine, and Wine is not an adequate
substitute here — the NSIS installer's UAC/elevation flow behaves
differently under Wine than on real Windows, and I did not chase that
further since it wouldn't tell us anything true about the real target.
If the installer or first-run fails on an actual Windows machine,
the most likely failure points are:

1. Windows Defender/SmartScreen flagging the unsigned `.exe` (expected
   — there's no code-signing certificate configured; you'll need to
   click through "More info → Run anyway", or add a real cert via
   `electron-builder`'s `win.certificateFile`/`certificatePassword`
   for a production release).
2. Firewall prompting to allow the app to listen on `127.0.0.1` — should
   be safe to allow, it's not listening on any external interface.
3. Port `55432` (Postgres) or `4173` (Next.js) already in use on the
   target machine — both are hardcoded in `main.js`; if that turns out
   to be a problem in practice, they should be made dynamic (bind to
   port 0 and read back the assigned port).
