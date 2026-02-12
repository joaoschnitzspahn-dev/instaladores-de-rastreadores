const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");
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

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Entrando...", "info");
  const fd = new FormData(form);
  const body = {
    email: fd.get("email"),
    senha: fd.get("senha"),
    tipo: fd.get("tipo")
  };
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data?.error || "Erro ao entrar.", "warn");
      return;
    }
    localStorage.setItem("infra_token", data.token);
    localStorage.setItem("infra_tipo", data.tipo || data.role);
    setMsg("Redirecionando...", "ok");
    if (data.tipo === "user" || data.role === "user") window.location.href = "/dashboard-user.html";
    else if (data.tipo === "admin" || data.role === "admin") window.location.href = "/admin.html";
    else window.location.href = "/dashboard-installer.html";
  } catch (err) {
    setMsg("Falha de conexão. Tente novamente.", "warn");
  }
});
