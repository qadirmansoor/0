const STATUS_POLL_MS = 1000;
const REJECTS_POLL_MS = 5000;

const el = (id) => document.getElementById(id);

async function postJSON(path) {
  const res = await fetch(path, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${path} failed: ${res.status}`);
  return body;
}

let actionErrorTimer = null;

function showActionError(message) {
  const box = el("action-error");
  box.textContent = message;
  box.classList.remove("hidden");
  clearTimeout(actionErrorTimer);
  actionErrorTimer = setTimeout(() => box.classList.add("hidden"), 6000);
}

function formatPercent(passed, total) {
  if (!total) return "--%";
  return `${Math.round((passed / total) * 100)}%`;
}

function updateBadge(elm, connected, label) {
  elm.textContent = `${label}: ${connected === null ? "n/a" : connected ? "connected" : "disconnected"}`;
  elm.classList.remove("ok", "down");
  if (connected === true) elm.classList.add("ok");
  if (connected === false) elm.classList.add("down");
}

async function refreshStatus() {
  try {
    const res = await fetch("/status");
    if (!res.ok) return;
    const s = await res.json();

    el("line-name").textContent = s.line_name || "Vision Inspection";
    el("run-dot").classList.toggle("running", !!s.running);

    updateBadge(el("camera-badge"), s.camera_connected, "camera");
    updateBadge(el("printer-badge"), s.printer_connected, "printer");

    el("stat-inspected").textContent = s.total_inspected;
    el("stat-passed").textContent = s.total_passed;
    el("stat-rejected").textContent = s.total_rejected;
    el("stat-rate").textContent = formatPercent(s.total_passed, s.total_inspected);
    el("stat-queue").textContent = s.pending_reject_queue;

    const banner = el("result-banner");
    if (s.last_result_passed === null || s.last_result_passed === undefined) {
      banner.textContent = "Waiting for inspection data…";
      banner.className = "result-banner";
    } else if (s.last_result_passed) {
      banner.textContent = "PASS";
      banner.className = "result-banner pass";
    } else {
      const defects = (s.last_defects || []).join(", ") || "inspection_failed";
      banner.textContent = `FAIL — ${defects}`;
      banner.className = "result-banner fail";
    }
  } catch (err) {
    console.error("status poll failed", err);
  }
}

async function refreshRejects() {
  try {
    const res = await fetch("/rejects/recent?limit=12");
    if (!res.ok) return;
    const { rejects } = await res.json();
    const grid = el("rejects-grid");

    if (!rejects || rejects.length === 0) {
      grid.innerHTML = '<p class="empty-note">No rejects yet.</p>';
      return;
    }

    grid.innerHTML = rejects
      .map((r) => {
        const when = r.timestamp_ms ? new Date(r.timestamp_ms).toLocaleTimeString() : "";
        return `
          <div class="reject-card">
            <img src="${r.image_url}" alt="Rejected unit ${r.product_id || ""}" loading="lazy" />
            <div class="reject-meta">${when} ${r.product_id || ""}</div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("rejects poll failed", err);
  }
}

el("start-btn").addEventListener("click", () =>
  postJSON("/start").catch((err) => showActionError(err.message))
);
el("stop-btn").addEventListener("click", () =>
  postJSON("/stop").catch((err) => showActionError(err.message))
);
el("test-reject-btn").addEventListener("click", () =>
  postJSON("/reject/test").catch((err) => showActionError(err.message))
);

refreshStatus();
refreshRejects();
setInterval(refreshStatus, STATUS_POLL_MS);
setInterval(refreshRejects, REJECTS_POLL_MS);
