const splash = document.getElementById("splash");
const adminLoginCard = document.getElementById("adminLoginCard");
const adminPanelCard = document.getElementById("adminPanelCard");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginMsg = document.getElementById("adminLoginMsg");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const statusFilterEl = document.getElementById("statusFilter");
const searchInputEl = document.getElementById("searchInput");
const listEl = document.getElementById("list");

function hideSplash() {
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 400);
}
window.addEventListener("DOMContentLoaded", () => setTimeout(hideSplash, 500));

function getToken() {
  return localStorage.getItem("infra_token") || "";
}

function setAdminUI(isAdmin) {
  if (adminLoginCard) adminLoginCard.style.display = isAdmin ? "none" : "block";
  if (adminPanelCard) adminPanelCard.style.display = isAdmin ? "block" : "none";
}

async function checkAdmin() {
  const token = getToken();
  if (!token) {
    setAdminUI(false);
    return;
  }
  try {
    const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (data.tipo === "admin" || data.role === "admin") {
      setAdminUI(true);
      load();
    } else setAdminUI(false);
  } catch (_) {
    setAdminUI(false);
  }
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMsg(text) {
  if (!listEl) return;
  listEl.innerHTML = `<div class="note">${esc(text)}</div>`;
}

async function fetchJSON(url, opts = {}) {
  const token = getToken();
  const headers = { ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

function render(rows) {
  if (!rows || rows.length === 0) return showMsg("Nenhum registro encontrado.");

  listEl.innerHTML = rows.map((r) => {
    const doc = r.documento_path ? `<a class="navBtn" target="_blank" rel="noopener" href="${esc(r.documento_path)}">📄 Documento</a>` : "";
    const selfie = r.selfie_path ? `<a class="navBtn" target="_blank" rel="noopener" href="${esc(r.selfie_path)}">🤳 Selfie</a>` : "";
    const specs = r.specialties ? (typeof r.specialties === "string" ? (() => { try { return JSON.parse(r.specialties); } catch (_) { return []; } })() : r.specialties) : (r.especialidade ? [r.especialidade] : []);

    const actions = r.status === "pending"
      ? `
        <button class="btn btnPrimary" data-act="approve" data-id="${r.id}">✅ Aprovar</button>
        <button class="btn" data-act="reject" data-id="${r.id}">⛔ Rejeitar</button>
      `
      : `<div class="note">Status: <strong>${esc(r.status)}</strong></div>`;

    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:800;">${esc(r.nome)} <span class="note">CPF: ${esc(r.cpf)} • ${esc(r.cidade)}/${esc(r.estado)}</span></div>
        <div class="note">${(specs && specs.length ? specs : [r.especialidade]).filter(Boolean).join(" • ")} • ${esc(r.tipo_atendimento)}</div>
        <div class="note">Email: ${esc(r.email)} • Tel: ${esc(r.telefone)} • Whats: ${esc(r.whatsapp)}</div>
        <div class="note">Status: <strong>${esc(r.status)}</strong></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">${doc} ${selfie}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">${actions}</div>
      </div>
    `;
  }).join("");
}

async function load() {
  const status = (statusFilterEl?.value || "").trim();
  const search = (searchInputEl?.value || "").trim();
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (search) qs.set("search", search);

  try {
    const rows = await fetchJSON(`/api/admin/installers?${qs.toString()}`);
    render(rows);
  } catch (e) {
    showMsg(e.message);
  }
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    adminLoginMsg.textContent = "Entrando...";
    adminLoginMsg.className = "note note-info";
    const fd = new FormData(adminLoginForm);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          senha: fd.get("senha"),
          tipo: "admin"
        })
      });
      const data = await res.json();
      if (!res.ok) {
        adminLoginMsg.textContent = data?.error || "Erro ao entrar.";
        adminLoginMsg.className = "note note-warn";
        return;
      }
      localStorage.setItem("infra_token", data.token);
      localStorage.setItem("infra_tipo", "admin");
      setAdminUI(true);
      load();
    } catch (err) {
      adminLoginMsg.textContent = "Falha de conexão.";
      adminLoginMsg.className = "note note-warn";
    }
  });
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", () => {
    localStorage.removeItem("infra_token");
    localStorage.removeItem("infra_tipo");
    setAdminUI(false);
    adminLoginForm?.reset();
    adminLoginMsg.textContent = "";
  });
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const act = btn.getAttribute("data-act");
  try {
    if (act === "approve") await fetchJSON(`/api/admin/installers/${id}/approve`, { method: "POST" });
    if (act === "reject") await fetchJSON(`/api/admin/installers/${id}/reject`, { method: "POST" });
    load();
  } catch (e2) {
    showMsg(e2.message);
  }
});

statusFilterEl?.addEventListener("change", load);
searchInputEl?.addEventListener("input", () => {
  clearTimeout(window.__admTimer);
  window.__admTimer = setTimeout(load, 250);
});

checkAdmin();
