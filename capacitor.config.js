require("dotenv").config();

/** URL do servidor onde o app está hospedado (obrigatório para o APK funcionar) */
const APP_URL = process.env.APP_URL || "https://SEU-SERVIDOR.com";

module.exports = {
  appId: "com.instaladores.rastreadores",
  appName: "Instaladores de Rastreadores",
  webDir: "public",
  server: {
    url: APP_URL,
    cleartext: true, // permite HTTP (use false em produção com HTTPS)
  },
  android: {
    allowMixedContent: true,
  },
};
