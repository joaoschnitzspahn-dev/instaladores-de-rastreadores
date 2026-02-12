// ====== ELEMENTOS ======
const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");

const estadoSelect = document.getElementById("estadoSelect");
const cidadeSelect = document.getElementById("cidadeSelect");

const documentoInput = document.getElementById("documentoInput");
const documentoBtn = document.getElementById("documentoBtn");
const documentoName = document.getElementById("documentoName");

const selfieInput = document.getElementById("selfieInput");
const selfieBtn = document.getElementById("selfieBtn");
const selfieName = document.getElementById("selfieName");
const selfiePreview = document.getElementById("selfiePreview");
const selfieChip = document.getElementById("selfieChip");

const splash = document.getElementById("splash");

// ====== SPLASH ======
function hideSplash() {
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 550);
}
window.addEventListener("DOMContentLoaded", () => setTimeout(hideSplash, 600));

// ====== TOAST ======
function toast(text, ok = true) {
  const t = document.createElement("div");
  t.className = "toast " + (ok ? "ok" : "err");
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ====== MENSAGEM INLINE ======
function setMsg(text, type = "") {
  msg.textContent = text || "";
  msg.className = "note " + (type ? `note-${type}` : "");
}

// ====== MÁSCARAS ======
function maskCPF(v) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{4})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{4})$/, "$1-$2");
}

// liga máscaras
const cpfEl = document.querySelector('[name="cpf"]');
const telEl = document.querySelector('[name="telefone"]');
const waEl = document.querySelector('[name="whatsapp"]');

if (cpfEl) cpfEl.addEventListener("input", (e) => (e.target.value = maskCPF(e.target.value)));
if (telEl) telEl.addEventListener("input", (e) => (e.target.value = maskPhone(e.target.value)));
if (waEl) waEl.addEventListener("input", (e) => (e.target.value = maskPhone(e.target.value)));

// ====== CIDADES (IBGE) ======
async function fetchIBGECities(uf) {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao consultar IBGE");
  const data = await res.json();
  return data.map((c) => c.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function resetCities() {
  if (!cidadeSelect) return;
  cidadeSelect.disabled = true;
  cidadeSelect.innerHTML = `<option value="">Cidade *</option>`;
}

if (estadoSelect && cidadeSelect) {
  estadoSelect.addEventListener("change", async () => {
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
      setMsg("Não consegui carregar as cidades do IBGE. Tente novamente.", "warn");
      toast("Erro ao carregar cidades (IBGE).", false);
    }
  });
}

// ====== FILE UX ======
function setSelfieOk(ok) {
  if (!selfieChip) return;
  selfieChip.textContent = ok ? "Selecionada" : "Obrigatório";
  selfieChip.className = ok ? "chip chipOk" : "chip";
}

if (documentoBtn && documentoInput) {
  documentoBtn.addEventListener("click", () => documentoInput.click());
}
if (selfieBtn && selfieInput) {
  selfieBtn.addEventListener("click", () => selfieInput.click());
}

if (documentoInput && documentoName) {
  documentoInput.addEventListener("change", () => {
    const f = documentoInput.files?.[0];
    documentoName.textContent = f ? f.name : "Nenhum arquivo selecionado";
  });
}

if (selfieInput && selfieName && selfiePreview) {
  let prevUrl = null;
  selfieInput.addEventListener("change", () => {
    const f = selfieInput.files?.[0];
    selfieName.textContent = f ? f.name : "Nenhum arquivo selecionado";
    setSelfieOk(!!f);

    if (prevUrl) URL.revokeObjectURL(prevUrl);
    prevUrl = null;

    if (!f) {
      selfiePreview.removeAttribute("src");
      selfiePreview.style.display = "none";
      return;
    }

    const url = URL.createObjectURL(f);
    prevUrl = url;
    selfiePreview.src = url;
    selfiePreview.style.display = "block";
  });
}

// ====== SUBMIT ======
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    setMsg("Enviando...", "info");

    const selectedSpecialties = Array.from(form.querySelectorAll('input[name="specialties"]:checked')).map(c => c.value);
    if (selectedSpecialties.length === 0) {
      setMsg("Selecione ao menos uma especialidade.", "warn");
      toast("Selecione ao menos uma especialidade.", false);
      return;
    }
    if (!documentoInput?.files?.[0]) {
      setMsg("Selecione o documento para validação.", "warn");
      toast("Selecione o documento.", false);
      return;
    }
    if (!selfieInput?.files?.[0]) {
      setMsg("Selecione a selfie de verificação.", "warn");
      toast("Selecione a selfie.", false);
      return;
    }

    if (waEl && telEl && !waEl.value.trim()) waEl.value = telEl.value.trim();

    const fd = new FormData(form);
    fd.delete("specialties");
    selectedSpecialties.forEach((v) => fd.append("specialties", v));
    const especialidadeHidden = document.getElementById("especialidadeHidden");
    if (especialidadeHidden) especialidadeHidden.value = selectedSpecialties[0];

    try {
      const res = await fetch("/api/installers", {
        method: "POST",
        body: fd
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const err = data.error || "Erro ao enviar cadastro.";
        setMsg(err, "warn");
        toast(err, false);
        return;
      }

      setMsg("Cadastro enviado! Status: pendente de aprovação.", "ok");
      toast("Cadastro enviado com sucesso ✅", true);

      form.reset();
      resetCities();

      if (documentoName) documentoName.textContent = "Nenhum arquivo selecionado";
      if (selfieName) selfieName.textContent = "Nenhum arquivo selecionado";
      if (selfiePreview) {
        selfiePreview.removeAttribute("src");
        selfiePreview.style.display = "none";
      }
      setSelfieOk(false);
    } catch (err) {
      setMsg("Falha ao enviar. Verifique sua conexão e tente novamente.", "warn");
      toast("Falha de rede ao enviar.", false);
    }
  });
}

// init
resetCities();
setMsg("");
if (selfiePreview) selfiePreview.style.display = "none";
setSelfieOk(false);