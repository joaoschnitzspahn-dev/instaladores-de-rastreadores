const splash = document.getElementById("splash");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const hint = document.getElementById("hint");
const interestsList = document.getElementById("interestsList");

function getToken() {
  return localStorage.getItem("infra_token");
}

function hideSplash() {
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 400);
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchAuth(url, opts = {}) {
  const token = getToken();
  if (!token) return Promise.reject(new Error("Não logado"));
  const res = await fetch(url, {
    ...opts,
    headers: { ...opts.headers, Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

async function sendProposal(leadId, price, eta, notes) {
  await fetchAuth("/api/proposals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: leadId, price, eta, notes })
  });
}

function renderLeads(rows) {
  if (!rows || rows.length === 0) {
    interestsList.innerHTML = `<div class="note">Nenhum lead ainda. Quando um cliente clicar em "Tenho interesse" no seu perfil, aparecerá aqui.</div>`;
    return;
  }

  interestsList.innerHTML = rows
    .map((r) => {
      const wa = r.user_telefone ? `https://wa.me/55${r.user_telefone.replace(/\D/g, "")}` : "";
      const hasProposal = r.proposal && r.proposal.id;
      return `
        <div class="interestCard" data-id="${r.id}">
          <h4>${esc(r.user_nome)}</h4>
          <div class="note">Email: ${esc(r.user_email)} • Tel: ${esc(r.user_telefone)}</div>
          <div class="note">${esc(r.city)}/${esc(r.uf)} • ${esc(r.specialty_requested || "—")}</div>
          ${r.details ? `<div class="note">Pedido: ${esc(r.details)}</div>` : ""}
          ${wa ? `<a class="navBtn" target="_blank" rel="noopener" href="${wa}">💬 WhatsApp</a>` : ""}
          ${hasProposal
            ? `
          <div class="note" style="margin-top:12px;"><strong>Proposta enviada:</strong></div>
          <div class="note">Valor: ${esc(r.proposal.price || "—")} • Prazo: ${esc(r.proposal.eta || "—")}</div>
          <div class="note">${esc(r.proposal.notes || "")}</div>
          `
            : `
          <p class="stepLabel" style="margin-top:12px;">Enviar proposta</p>
          <input class="input" type="text" placeholder="Valor (ex: R$ 150)" data-lead-id="${r.id}" data-field="price" />
          <input class="input" type="text" placeholder="Prazo (ex: 2 dias)" data-lead-id="${r.id}" data-field="eta" />
          <textarea class="input" placeholder="Observações" data-lead-id="${r.id}" data-field="notes" rows="2"></textarea>
          <button type="button" class="btn btnPrimary btnSendProposal" data-lead-id="${r.id}">Enviar proposta</button>
          `}
        </div>
      `;
    })
    .join("");

  interestsList.querySelectorAll(".btnSendProposal").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const leadId = Number(btn.getAttribute("data-lead-id"));
      const card = btn.closest(".interestCard");
      const price = (card?.querySelector('[data-field="price"]')?.value || "").trim();
      const eta = (card?.querySelector('[data-field="eta"]')?.value || "").trim();
      const notes = (card?.querySelector('[data-field="notes"]')?.value || "").trim();
      btn.disabled = true;
      btn.textContent = "Enviando...";
      try {
        await sendProposal(leadId, price, eta, notes);
        btn.textContent = "Enviado ✓";
        loadLeads();
      } catch (e) {
        alert(e.message || "Erro ao enviar.");
      }
      btn.disabled = false;
    });
  });
}

async function loadLeads() {
  try {
    hint.textContent = "Carregando...";
    const list = await fetchAuth("/api/installer/leads");
    renderLeads(list);
    hint.textContent = list && list.length ? `${list.length} lead(s).` : "";
  } catch (e) {
    hint.textContent = "";
    interestsList.innerHTML = `<div class="note note-warn">${esc(e.message)}</div>`;
  }
}

async function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = "/login.html?redirect=/dashboard-installer.html";
    return;
  }
  try {
    const me = await fetchAuth("/api/me");
    if (me.tipo !== "installer") {
      localStorage.removeItem("infra_token");
      localStorage.removeItem("infra_tipo");
      window.location.href = "/login.html";
      return;
    }
    if (welcomeText) welcomeText.textContent = `Olá, ${me.nome || "instalador"}`;
  } catch (_) {
    localStorage.removeItem("infra_token");
    localStorage.removeItem("infra_tipo");
    window.location.href = "/login.html?redirect=/dashboard-installer.html";
    return;
  }
}

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("infra_token");
  localStorage.removeItem("infra_tipo");
  window.location.href = "/index.html";
});

window.addEventListener("DOMContentLoaded", async () => {
  hideSplash();
  await checkAuth();
  await loadLeads();
});
