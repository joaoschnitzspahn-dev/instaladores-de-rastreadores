# Deploy no DigitalOcean — Instaladores de Rastreadores

Você pode colocar o projeto na DigitalOcean de duas formas: **App Platform** (mais simples) ou **Droplet** (mais controle). Ambas usam a mesma aplicação Node.js.

---

## Opção 1: App Platform (recomendado para começar)

O App Platform é um PaaS: você conecta o repositório e a DigitalOcean faz o build e o deploy.

### 1. Preparar o repositório

- Coloque o projeto no **GitHub** (ou GitLab).
- No repositório, **não** envie a pasta `node_modules`, o arquivo `.env` nem o banco `infra.db`. Use um `.gitignore` como:

```gitignore
node_modules/
.env
infra.db
*.log
```

### 2. Criar o app na DigitalOcean

1. Acesse [cloud.digitalocean.com](https://cloud.digitalocean.com) e faça login.
2. No menu lateral: **Apps** → **Create App**.
3. **Choose Source:** GitHub (ou GitLab), autorize e selecione o repositório do projeto.
4. **Branch:** `main` (ou a branch que você usa).
5. **Resource Type:** escolha **Web Service** (não Static Site).
6. **Run Command:** deixe em branco; a DigitalOcean usa `npm start` por padrão (já configurado no `package.json`).
7. **Build Command:** deixe `npm install` ou use `npm ci` se tiver `package-lock.json`.

### 3. Variáveis de ambiente (App Platform)

No passo **Environment Variables** do App, adicione (substitua pelos seus valores):

| Nome | Valor | Obrigatório |
|------|--------|-------------|
| `PORT` | `8080` | Sim (App Platform usa 8080) |
| `NODE_ENV` | `production` | Recomendado |
| `ADMIN_USER` | email do admin | Sim |
| `ADMIN_PASS` | senha do admin | Sim |
| `ADMIN_KEY` | chave legada (opcional) | Não |
| `GMAIL_USER` | seu email Gmail | Se for enviar email |
| `GMAIL_APP_PASS` | senha de app do Gmail | Se for enviar email |
| `ADMIN_EMAIL` | email que recebe notificações | Se quiser notificações |

**Importante:** não coloque o `.env` no Git. Configure tudo em **Environment Variables** no painel do App.

### 4. Banco de dados e uploads no App Platform

- O **SQLite** (`infra.db`) e a pasta **uploads** ficam no disco do container. Em deploys novos ou quando o app reinicia, esse disco pode ser limpo (ambiente efêmero).
- Para **dados e arquivos persistentes** no App Platform:
  - **App Platform → seu App → Settings → App-Level** → adicione um **Volume** e monte em um caminho (ex.: `/data`).
  - Aí seria preciso alterar o código para usar `process.env.DATA_DIR || __dirname` e colocar `infra.db` e `uploads` dentro de `/data`. Se quiser, posso te passar as mudanças exatas no código.
- Se quiser **simplicidade** e não se importar em perder dados a cada deploy, pode deixar como está e usar o App Platform só para testar.

### 5. Deploy

- Clique em **Next** até **Create Resources** e depois em **Create App**.
- O primeiro deploy leva alguns minutos. Ao terminar, você recebe uma URL tipo `https://seu-app-xxxxx.ondigitalocean.app`.

### 6. Usar sua URL no código (emails, etc.)

- Nos emails (ex.: link do admin), use a URL real do app em produção, por exemplo:  
  `https://seu-app-xxxxx.ondigitalocean.app`  
  (no código do servidor há um `localhost` no email; em produção você pode definir algo como `APP_URL` no env e usar no template do email).

---

## Opção 2: Droplet (VPS) — dados persistentes

Com um Droplet você tem um servidor Linux fixo: SQLite e pasta `uploads` permanecem entre reinícios e deploys.

### 1. Criar o Droplet

1. **Create** → **Droplets**.
2. **Image:** Ubuntu 22.04 LTS.
3. **Plano:** Basic, $6/mês ou superior.
4. **Datacenter:** o mais próximo dos usuários.
5. Crie e anote o **IP** do Droplet. Use **SSH key** para acesso.

### 2. Conectar e instalar Node.js

```bash
ssh root@SEU_IP_DROPLET
```

Instalar Node 20 (LTS):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # deve mostrar v20.x
```

### 3. Instalar o projeto

```bash
# Criar usuário (recomendado)
adduser deploy
usermod -aG sudo deploy
su - deploy

# Clonar o repositório (ou enviar via SCP/SFTP)
git clone https://github.com/SEU_USUARIO/SEU_REPO.git instaladores
cd instaladores
npm install
```

### 4. Configurar variáveis de ambiente

```bash
nano .env
```

Conteúdo mínimo (ajuste os valores):

```env
PORT=3000
NODE_ENV=production
ADMIN_USER=admin@seusite.com
ADMIN_PASS=suasenha
GMAIL_USER=seu@gmail.com
GMAIL_APP_PASS=senha_de_app
ADMIN_EMAIL=seu@gmail.com
```

Salve (Ctrl+O, Enter, Ctrl+X).

### 5. Rodar com PM2 (permanente e com restart)

```bash
sudo npm install -g pm2
pm2 start server.js --name "instaladores"
pm2 save
pm2 startup   # segue as instruções que aparecerem
```

O app sobe na porta 3000. Para ver logs: `pm2 logs instaladores`.

### 6. Nginx como proxy reverso (HTTPS e porta 80)

```bash
sudo apt update
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/instaladores
```

Conteúdo (troque `SEU_DOMINIO` pelo seu domínio ou use o IP):

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO ou SEU_IP;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

Ativar e recarregar:

```bash
sudo ln -s /etc/nginx/sites-available/instaladores /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Acesse `http://SEU_IP` ou `http://SEU_DOMINIO`. Para HTTPS com certificado grátis, use **Let's Encrypt** (Certbot):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO
```

---

## Resumo rápido

| | App Platform | Droplet |
|---|--------------|---------|
| **Facilidade** | Conectar repo e configurar env | Instalar Node, Nginx, PM2 |
| **Custo** | A partir de ~US$ 5/mês | A partir de US$ 6/mês |
| **SQLite/uploads** | Efêmero (ou usar volume) | Persistente |
| **HTTPS** | Incluso | Configurar com Certbot |
| **Deploy** | Push no Git = novo deploy | `git pull` + `pm2 restart instaladores` |

Para **produção com dados e uploads persistentes**, use **Droplet**. Para **testar rápido**, use **App Platform**.

Se quiser, posso te ajudar a adaptar o código para usar um **volume** no App Platform (caminho `/data` para `infra.db` e `uploads`) ou a ajustar o link do admin nos emails para a URL de produção.
