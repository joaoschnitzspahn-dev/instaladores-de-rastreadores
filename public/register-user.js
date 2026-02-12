const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");
const estadoSelect = document.getElementById("estadoSelect");
const cidadeSelect = document.getElementById("cidadeSelect");
const splash = document.getElementById("splash");

function hideSplash() {
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 550);
}
window.addEventListener("DOMContentLoaded", () => setTimeout(hideSplash, 600));

function setMsg(text, type = "") {
  msg.textContent = text || "";
  msg.className = "note " + (type ? `note-${type}` : "");
}

function resetCities() {
  if (!cidadeSelect) return;
  cidadeSelect.disabled = true;
  cidadeSelect.innerHTML = `<option value="">Cidade *</option>`;
}

async function fetchIBGECities(uf) {
  const res = await fetch(`/api/ibge/cities?uf=${encodeURIComponent(uf)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Falha ao carregar cidades.");
  return data;
}

estadoSelect?.addEventListener("change", async () => {
  const uf = (estadoSelect.value || "").trim().toUpperCase();
  resetCities();
  if (!uf) return;
  try {
    setMsg("");
    cidadeSelect.innerHTML = `<option value="">Carregando cidades...</option>`;
    const cities = await fetchIBGECities(uf);
    cidadeSelect.innerHTML =
      `<option value="">Cidade *</option>` +
      cities.map((name) => `<option value="${name}">${name}</option>`).join("");
    cidadeSelect.disabled = false;
  } catch (e) {
    resetCities();
    setMsg("Erro ao carregar cidades.", "warn");
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Cadastrando...", "info");
  const fd = new FormData(form);
  const body = {
    nome: fd.get("nome"),
    email: fd.get("email"),
    telefone: fd.get("telefone"),
    senha: fd.get("senha"),
    estado: fd.get("estado"),
    cidade: fd.get("cidade")
  };
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data?.error || "Erro ao cadastrar.", "warn");
      return;
    }
    setMsg("Conta criada! Redirecionando para o login...", "ok");
    setTimeout(() => (window.location.href = "/login.html"), 1500);
  } catch (err) {
    setMsg("Falha de conexão. Tente novamente.", "warn");
  }
});

resetCities();
