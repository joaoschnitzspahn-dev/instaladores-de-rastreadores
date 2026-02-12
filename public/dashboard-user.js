const splash = document.getElementById("splash");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const mapStep = document.getElementById("mapStep");
const cityStep = document.getElementById("cityStep");
const backToMapBtn = document.getElementById("backToMap");
const cidadeSelect = document.getElementById("cidadeSelect");
const searchInput = document.getElementById("searchInput");
const installersList = document.getElementById("installersList");
const hint = document.getElementById("hint");
const brazilMap = document.getElementById("brazilMap");
const selectedStateEl = document.getElementById("selectedState");
const stateListEl = document.getElementById("stateList");
const myLeadsListEl = document.getElementById("myLeadsList");

const STATE_NAMES = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins"
};

let selectedUF = "";
let selectedCity = "";
let userLeads = []; // { installer_id } from GET /api/user/leads

function getToken() {
  return localStorage.getItem("infra_token");
}

function hideSplash() {
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 550);
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setHint(t) { if (hint) hint.textContent = t || ""; }

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

async function fetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

function resetCities(text = "Selecione uma cidade") {
  cidadeSelect.innerHTML = `<option value="">${text}</option>`;
  cidadeSelect.disabled = true;
  selectedCity = "";
}

function showMapStep() {
  if (mapStep) mapStep.hidden = false;
  if (cityStep) cityStep.hidden = true;
  if (selectedStateEl) selectedStateEl.textContent = "";
  selectedUF = "";
  selectedCity = "";
  resetCities();
  clearInstallers();
  setHint("");
  if (brazilMap) brazilMap.querySelectorAll("path.selected").forEach(p => p.classList.remove("selected"));
  if (stateListEl) stateListEl.querySelectorAll(".stateBtn.selected").forEach(b => b.classList.remove("selected"));
}

function selectUF(uf) {
  if (!uf || !STATE_NAMES[uf]) return;
  if (brazilMap) {
    brazilMap.querySelectorAll("path.selected").forEach((p) => p.classList.remove("selected"));
    const path = brazilMap.querySelector(`path[id="map${uf}"]`);
    if (path) path.classList.add("selected");
  }
  if (stateListEl) {
    stateListEl.querySelectorAll(".stateBtn").forEach((b) => {
      b.classList.toggle("selected", b.getAttribute("data-uf") === uf);
    });
  }
  selectedUF = uf;
  if (selectedStateEl) selectedStateEl.textContent = `${STATE_NAMES[uf]} (${uf})`;
  resetCities("Selecione uma cidade");
  clearInstallers();
  loadCities(uf);
  showCityStep();
}

function showCityStep() {
  if (mapStep) mapStep.hidden = true;
  if (cityStep) cityStep.hidden = false;
}

function clearInstallers() {
  installersList.innerHTML = "";
}

function getSelectedSpecFilter() {
  const els = document.querySelectorAll('#specialtyFilter input[name="specFilter"]:checked');
  return Array.from(els).map((e) => e.value).filter(Boolean);
}

function hasLead(installerId) {
  return userLeads.some((l) => l.installer_id === installerId);
}

async function addLead(installerId) {
  try {
    await fetchAuth("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installer_id: installerId,
        uf: selectedUF,
        city: selectedCity,
        specialty_requested: getSelectedSpecFilter().join(", ") || "",
        details: ""
      })
    });
    userLeads.push({ installer_id: installerId });
    loadInstallers();
  } catch (e) {
    alert(e.message || "Erro ao enviar solicitação.");
  }
}

function renderInstallers(data) {
  if (!data || data.length === 0) {
    installersList.innerHTML = `<div class="note">Nenhum instalador aprovado encontrado para esse filtro.</div>`;
    return;
  }

  const specsLabel = (i) => (Array.isArray(i.specialties) && i.specialties.length ? i.specialties.join(" • ") : esc(i.especialidade || ""));

  installersList.innerHTML = data.map((i) => {
    const wa = i.whatsapp ? `https://wa.me/${encodeURIComponent(i.whatsapp)}` : "";
    const already = hasLead(i.id);
    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:800; font-size:15px;">${esc(i.nome)}</div>
        <div class="note">${specsLabel(i)} • ${esc(i.tipo_atendimento)}</div>
        <div class="note">${esc(i.cidade)}/${esc(i.estado)}</div>
        <div class="note">Tel: ${esc(i.telefone)} • Whats: ${esc(i.whatsapp)}</div>
        ${wa ? `<a class="navBtn" target="_blank" rel="noopener" href="${wa}">💬 WhatsApp</a>` : ""}
        ${already ? `<span class="note note-ok">✓ Solicitação enviada</span>` : `<button type="button" class="btn btnPrimary" data-installer-id="${i.id}">Tenho interesse / Solicitar orçamento</button>`}
      </div>
    `;
  }).join("");

  installersList.querySelectorAll("button[data-installer-id]").forEach((btn) => {
    btn.addEventListener("click", () => addLead(Number(btn.getAttribute("data-installer-id"))));
  });
}

async function loadUserLeads() {
  try {
    const list = await fetchAuth("/api/user/leads");
    userLeads = list || [];
  } catch (_) {
    userLeads = [];
  }
}

async function loadMyLeadsPanel() {
  if (!myLeadsListEl) return;
  try {
    const list = await fetchAuth("/api/user/leads");
    if (!list || list.length === 0) {
      myLeadsListEl.innerHTML = "<p class=\"note\">Você ainda não enviou nenhuma solicitação.</p>";
      return;
    }
    myLeadsListEl.innerHTML = list
      .map((l) => {
        const prop = (l.proposals && l.proposals[0]) || null;
        const decided = l.user_decision === "accepted" || l.user_decision === "rejected";
        let statusLabel = "Aguardando";
        if (decided) statusLabel = l.user_decision === "accepted" ? "Aceita" : "Rejeitada";
        else if (prop) statusLabel = "Proposta enviada";
        const showActions = prop && !decided;
        return `
          <div class="interestCard" style="margin-top:8px;" data-lead-id="${l.id}">
            <strong>${esc(l.installer_nome)}</strong> — ${esc(l.city)}/${esc(l.uf)}
            <span class="note">• ${statusLabel}</span>
            ${prop ? `<div class="note">Valor: ${esc(prop.price)} • Prazo: ${esc(prop.eta)}</div><div class="note">${esc(prop.notes)}</div>` : ""}
            ${showActions ? `
              <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
                <button type="button" class="btn btnPrimary btnAcceptProposal" data-lead-id="${l.id}">✓ Aceitar</button>
                <button type="button" class="btn btnRejectProposal" data-lead-id="${l.id}">Rejeitar</button>
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");

    myLeadsListEl.querySelectorAll(".btnAcceptProposal").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-lead-id"));
        btn.disabled = true;
        try {
          const res = await fetchAuth(`/api/user/leads/${id}/decision`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "accepted" })
          });
          if (res.whatsapp_url) window.open(res.whatsapp_url, "_blank", "noopener");
          loadMyLeadsPanel();
        } catch (e) {
          alert(e.message || "Erro ao aceitar.");
        }
        btn.disabled = false;
      });
    });
    myLeadsListEl.querySelectorAll(".btnRejectProposal").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-lead-id"));
        if (!confirm("Rejeitar esta proposta?")) return;
        btn.disabled = true;
        try {
          await fetchAuth(`/api/user/leads/${id}/decision`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "rejected" })
          });
          loadMyLeadsPanel();
        } catch (e) {
          alert(e.message || "Erro ao rejeitar.");
        }
        btn.disabled = false;
      });
    });
  } catch (_) {
    myLeadsListEl.innerHTML = "<p class=\"note note-warn\">Erro ao carregar.</p>";
  }
}

async function loadCities(uf) {
  try {
    setHint("Carregando cidades...");
    resetCities("Carregando cidades...");
    clearInstallers();
    const cities = await fetchJSON(`/api/locations/cities?uf=${encodeURIComponent(uf)}`);
    cidadeSelect.innerHTML =
      `<option value="">Selecione uma cidade</option>` +
      cities.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
    cidadeSelect.disabled = false;
    setHint("Agora selecione uma cidade.");
  } catch (e) {
    resetCities("Selecione uma cidade");
    setHint("Erro ao carregar cidades.");
  }
}

async function loadInstallers() {
  if (!selectedUF || !selectedCity) return;
  try {
    setHint("Carregando instaladores...");
    const q = (searchInput?.value || "").trim();
    const specs = getSelectedSpecFilter();
    let url = `/api/installers?uf=${encodeURIComponent(selectedUF)}&cidade=${encodeURIComponent(selectedCity)}`;
    if (q) url += `&search=${encodeURIComponent(q)}`;
    if (specs.length) url += `&specialties=${encodeURIComponent(specs.join(","))}`;
    const list = await fetchJSON(url);
    await loadUserLeads();
    renderInstallers(list);
    setHint(`Mostrando aprovados em ${selectedCity}/${selectedUF}.`);
  } catch (e) {
    setHint("Erro ao carregar instaladores.");
  }
}

async function initBrazilMap() {
  if (!brazilMap) return;
  try {
    const res = await fetch("/assets/brasil.svg");
    const svgText = await res.text();
    brazilMap.innerHTML = svgText;
    setHint("Clique em um estado no mapa e depois selecione a cidade.");
    brazilMap.querySelectorAll("path[id^='map']").forEach((path) => {
      path.style.cursor = "pointer";
      const id = path.getAttribute("id") || "";
      const uf = id.replace(/^map/, "").toUpperCase();
      path.addEventListener("click", () => selectUF(uf));
    });
    const statesRes = await fetch("/api/locations/states");
    const states = await statesRes.json();
    if (stateListEl && states && states.length) {
      stateListEl.innerHTML = states
        .map((s) => `<button type="button" class="stateBtn" data-uf="${s.uf}">${s.uf}</button>`)
        .join("");
      stateListEl.querySelectorAll(".stateBtn").forEach((btn) => {
        btn.addEventListener("click", () => selectUF(btn.getAttribute("data-uf")));
      });
    }
  } catch (e) {
    setHint("Erro ao carregar o mapa.");
  }
}

async function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = "/login.html?redirect=/dashboard-user.html";
    return;
  }
  try {
    const me = await fetchAuth("/api/me");
    if (me.tipo !== "user") {
      localStorage.removeItem("infra_token");
      localStorage.removeItem("infra_tipo");
      window.location.href = "/login.html";
      return;
    }
    if (welcomeText) welcomeText.textContent = `Olá, ${me.nome || "usuário"}`;
    loadMyLeadsPanel();
  } catch (_) {
    localStorage.removeItem("infra_token");
    localStorage.removeItem("infra_tipo");
    window.location.href = "/login.html?redirect=/dashboard-user.html";
    return;
  }
}

if (backToMapBtn) backToMapBtn.addEventListener("click", showMapStep);

cidadeSelect.addEventListener("change", async () => {
  selectedCity = (cidadeSelect.value || "").trim();
  clearInstallers();
  if (!selectedCity) return setHint("Selecione uma cidade.");
  await loadInstallers();
});

searchInput.addEventListener("input", () => {
  if (!selectedUF || !selectedCity) return;
  clearTimeout(window.__t);
  window.__t = setTimeout(loadInstallers, 250);
});
document.querySelectorAll('#specialtyFilter input[name="specFilter"]').forEach((el) => {
  el.addEventListener("change", () => {
    if (!selectedUF || !selectedCity) return;
    loadInstallers();
  });
});

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("infra_token");
  localStorage.removeItem("infra_tipo");
  window.location.href = "/index.html";
});

window.addEventListener("DOMContentLoaded", async () => {
  hideSplash();
  await checkAuth();
  resetCities("Selecione uma cidade");
  initBrazilMap();
});
