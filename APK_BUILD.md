# Como gerar o APK — Instaladores de Rastreadores

O app usa **Capacitor** para criar um APK que carrega o site diretamente do seu servidor.

> **Recomendado:** use o Android Studio para gerar o APK (inclui o Java necessário).

## 1. Configurar a URL do servidor

Edite o arquivo `.env` e defina a URL do seu servidor:

```
APP_URL=https://seu-dominio.com
```

Exemplos:
- `https://instaladores.vercel.app`
- `https://app.seudominio.com.br`
- `https://192.168.1.10:3000` (apenas para testes locais)

## 2. Instalar dependências

```bash
npm install
```

## 3. Adicionar a plataforma Android (primeira vez)

```bash
npx cap add android
```

## 4. Sincronizar e abrir no Android Studio

```bash
npm run android
```

Ou manualmente:

```bash
npm run cap:sync
npm run cap:open
```

## 5. Gerar o APK no Android Studio

1. Com o projeto aberto no Android Studio, vá em **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. O APK será gerado em:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
3. Para um APK de **release** (para publicar na Play Store), use **Build → Generate Signed Bundle / APK** e siga o assistente.

## Pré-requisitos

- **Node.js** instalado
- **Android Studio** — [baixar aqui](https://developer.android.com/studio)
  - Já inclui o Java necessário
  - Após instalar, abra o Android Studio uma vez para concluir a configuração inicial

## Se o comando `npm run android` não encontrar o Android Studio

Configure o caminho manualmente (PowerShell):

```powershell
$env:CAPACITOR_ANDROID_STUDIO_PATH = "C:\Program Files\Android\Android Studio\bin\studio64.exe"
npm run android
```

Ou abra o projeto manualmente: **File → Open** → selecione a pasta `android` do projeto.

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run cap:sync` | Sincroniza o projeto com o Android |
| `npm run cap:open` | Abre o projeto no Android Studio |
| `npm run android` | Sincroniza + abre no Android Studio |
