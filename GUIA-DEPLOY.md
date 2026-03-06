# Guia completo: Build, Git e atualização no servidor

Este guia cobre como fazer o build, subir para o Git e atualizar o servidor na DigitalOcean.

---

## 1. Preparar o projeto

### 1.1 Configurar a URL do servidor (para o APK)

Edite o arquivo `.env` e defina a URL do seu servidor:

```
APP_URL=http://138.197.223.219:3000
```

Ou use seu domínio se tiver HTTPS configurado.

### 1.2 Gerar ícones do APK (se ainda não fez)

Se quiser usar sua própria imagem como ícone, substitua `resources/icon.png` pela sua imagem (recomendado 1024x1024 px) e rode:

```bash
npx @capacitor/assets generate
```

---

## 2. Build e sincronização

### 2.1 Instalar dependências

```bash
npm install
```

### 2.2 Sincronizar com o Android

```bash
npx cap sync android
```

Isso copia os arquivos do `public` para o projeto Android.

### 2.3 Gerar o APK (opcional)

1. Abra o Android Studio: `npx cap open android`
2. Vá em **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. O APK sai em: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 3. Enviar para o Git

```bash
git add .
git status
git commit -m "Novos campos no cadastro (valor, km) e ícone do APK"
git push origin main
```

Se for a primeira vez configurando o repositório:

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git branch -M main
git push -u origin main
```

---

## 4. Atualizar no servidor DigitalOcean

Conecte via SSH e atualize o projeto:

```bash
ssh root@138.197.223.219
```

Depois, localize o diretório do projeto (ex.: `instaladores`, `infra-instaladores` ou similar):

```bash
find / -name "infra.db" 2>/dev/null
```

Isso mostra o caminho (ex.: `/root/instaladores/infra.db`). Entre na pasta:

```bash
cd /root/instaladores
```

Atualize o código do Git:

```bash
git pull origin main
```

Instale dependências (se houver mudanças):

```bash
npm install
```

Reinicie o app com PM2:

```bash
pm2 restart instaladores
```

Para ver os logs:

```bash
pm2 logs instaladores
```

---

## 5. Migração do banco (novos campos)

Se o servidor já tinha instaladores cadastrados antes desta atualização, as novas colunas (`valor_base`, `km_maximo`, `valor_por_km`) serão criadas automaticamente pelo servidor na primeira execução.

Instaladores antigos terão esses campos vazios. Novos cadastros já preenchem os valores.

---

## 6. Resumo dos comandos

| Etapa | Comando |
|-------|---------|
| Sincronizar Android | `npx cap sync android` |
| Abrir Android Studio | `npx cap open android` |
| Commit e push | `git add . && git commit -m "mensagem" && git push` |
| Atualizar servidor | `ssh root@138.197.223.219` → `cd instaladores` → `git pull` → `pm2 restart instaladores` |

---

## 7. Checklist antes do deploy

- [ ] `.env` com `APP_URL` correto (para o APK)
- [ ] Testar localmente: `npm start`
- [ ] Verificar se os novos campos aparecem no cadastro (valor base, km máximo, valor/km)
- [ ] Confirmar que o ícone do APK está correto
