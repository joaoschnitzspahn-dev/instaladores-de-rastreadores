// Splash: logo + loader por ~1.5s, depois redireciona visualmente para o conteúdo (home)
const splash = document.getElementById("splash");
function hideSplash() {
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 400);
}
window.addEventListener("DOMContentLoaded", () => setTimeout(hideSplash, 1500));
