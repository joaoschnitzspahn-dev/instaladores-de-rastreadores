# Reformulação — Instaladores de Rastreadores

**Imagens:** Coloque a nova logo em `public/assets/logo.png` e o personagem em `public/assets/personagem.png` (substitua ou renomeie os arquivos que você recebeu).

## Estrutura de pastas final

```
infra-instaladores/
├── server.js              # Backend Express (auth, admin, locations, installers, leads, proposals)
├── package.json           # Inalterado
├── .env                   # ADMIN_USER, ADMIN_PASS, PORT, etc.
├── infra.db               # SQLite (installers, users, interests, leads, proposals)
├── public/
│   ├── index.html         # Home (splash + cards: Cadastrar Instalador, Sou Cliente, Login)
│   ├── app.js             # Splash ~1.5s → conteúdo
│   ├── styles.css         # Design Apple-like (light, Inter, frosted, sombras suaves)
│   ├── login.html / login.js
│   ├── register.html      # Cadastro instalador (multiselect especialidades)
│   ├── register.js
│   ├── register-user.html / register-user.js
│   ├── dashboard-user.html / dashboard-user.js  # Busca (mapa + lista UF, cidade, filtro especialidade, leads)
│   ├── dashboard-installer.html / dashboard-installer.js  # Leads + enviar proposta
│   ├── admin.html         # Login admin (email/senha) + lista pendentes, aprovar/rejeitar
│   ├── admin.js
│   └── assets/
│       ├── logo.png          (nova logo Instaladores de Rastreadores)
│       ├── personagem.png    (personagem instalador)
│       └── brasil.svg
├── uploads/
│   ├── documents/
│   └── selfies/
└── REFORMULACAO.md
```

## Como rodar

```bash
npm run dev
# ou
node server.js
```

Acesse: **http://localhost:3000**

## Exemplo de .env

```env
PORT=3000

# Admin (login por email/senha — obrigatório para área admin)
ADMIN_USER=admin@exemplo.com
ADMIN_PASS=suasenha123

# Legado (opcional; ainda aceito no painel)
ADMIN_KEY=infra-1234

# Email (opcional)
ADMIN_EMAIL=seu@email.com
GMAIL_USER=seu@gmail.com
GMAIL_APP_PASS=senha_de_app
```

## Endpoints principais

### Auth
- `POST /api/auth/login` — Body: `{ email, senha, tipo: "user"|"installer"|"admin" }` → `{ token, role }`
- `POST /api/auth/register-user` — Cadastro usuário (alias de `POST /api/users`)
- `POST /api/installers` (multipart) — Cadastro instalador (documento, selfie, **specialties** multiselect)

### Locations
- `GET /api/locations/states` — Lista de UFs
- `GET /api/locations/cities?uf=SC` — Cidades do estado (IBGE)

### Busca (público para listar; user logado para leads)
- `GET /api/installers?uf=SC&cidade=Penha&specialties=Telemetria,Vídeo%20Telemetria&search=opcional` — Só aprovados, filtro por especialidades

### Leads / Propostas
- `POST /api/leads` (auth: user) — Body: `{ installer_id, uf, city, specialty_requested, details }`
- `GET /api/installer/leads` (auth: installer) — Leads do instalador + proposta se houver
- `POST /api/proposals` (auth: installer) — Body: `{ lead_id, price, eta, notes }`
- `GET /api/user/leads` (auth: user) — Leads do usuário + propostas

### Admin
- `GET /api/admin/installers/pending` (auth: admin ou x-admin-key) — Só pendentes
- `GET /api/admin/installers?status=&search=` (auth: admin ou key)
- `POST /api/admin/installers/:id/approve` (auth: admin ou key)
- `POST /api/admin/installers/:id/reject` (auth: admin ou key)

## Fluxos testados (resumo)

1. **Splash** — Abre index → splash ~1,5s → some e mostra home.
2. **Home** — Sem botão “Ver novos cadastrados”; link “Admin” no rodapé.
3. **Cadastro instalador** — Multiselect: Telemetria, Vídeo Telemetria, Rastreador com/sem Bloqueio; envio com documento e selfie; status pending.
4. **Cadastro usuário** — Mesmo padrão visual; redireciona para login.
5. **Login** — Tipo user / instalador / admin; redireciona para dashboard-user, dashboard-installer ou admin.
6. **Busca (usuário logado)** — Mapa do Brasil + lista de estados; cidade; filtro por especialidades; lista só aprovados; “Tenho interesse” cria lead.
7. **Painel instalador** — Lista de leads; formulário valor/prazo/observações → POST proposta.
8. **Painel usuário** — Seção “Minhas solicitações e propostas” com leads e propostas recebidas.
9. **Admin** — Login com ADMIN_USER/ADMIN_PASS; lista pendentes; Aprovar / Rejeitar.

## Especialidades (fixas)

- Telemetria  
- Vídeo Telemetria  
- Rastreador com Bloqueio  
- Rastreador sem Bloqueio  

Instalador escolhe uma ou mais no cadastro; o cliente filtra por elas na busca.
