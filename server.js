require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 Admin: key (legado) ou login/senha
const ADMIN_KEY = process.env.ADMIN_KEY || "infra-1234";
const ADMIN_USER = (process.env.ADMIN_USER || "").trim().toLowerCase();
const ADMIN_PASS = (process.env.ADMIN_PASS || "").trim();

// 📧 Gmail do admin que recebe as aprovações
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tiimperiodosrastreadores@gmail.com";

// Gmail de envio (pode ser o mesmo)
const GMAIL_USER = process.env.GMAIL_USER || "tiimperiodosrastreadores@gmail.com";
// Senha de app do Gmail (obrigatória para funcionar)
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || "";

// Paths
const DB_PATH = path.join(__dirname, "infra.db");
const PUBLIC_PATH = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads", "documents");
const SELFIES_DIR = path.join(__dirname, "uploads", "selfies");

// Garante pasta de uploads
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(SELFIES_DIR, { recursive: true });

// DB
const db = new sqlite3.Database(DB_PATH);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Front
app.use(express.static(PUBLIC_PATH));
// Servir uploads para o admin visualizar documento/selfie
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- HELPERS ----------
const STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" }
];

function normalizeUF(uf) {
  return String(uf || "").trim().toUpperCase();
}
function isValidUF(uf) {
  uf = normalizeUF(uf);
  return STATES.some(s => s.uf === uf);
}
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}
function toWhatsAppNumber(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}
function requireAdmin(req, res, next) {
  const key = req.header("x-admin-key") || req.query.key || "";
  if (key === ADMIN_KEY) return next();
  if (req.auth && req.auth.type === "admin") return next();
  return res.status(401).json({ error: "Não autorizado." });
}

// ---------- AUTH (tokens em memória + hash de senha) ----------
const crypto = require("crypto");
const tokens = new Map(); // token -> { type: 'user'|'installer'|'admin', id }
const SPECIALTIES_LIST = ["Telemetria", "Vídeo Telemetria", "Rastreador com Bloqueio", "Rastreador sem Bloqueio"];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const v = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return v === hash;
}
function createToken(type, id) {
  const token = crypto.randomBytes(32).toString("hex");
  tokens.set(token, { type, id });
  return token;
}
function authMiddleware(req, res, next) {
  const raw = req.header("Authorization") || "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  const data = tokens.get(token);
  if (!data) return res.status(401).json({ error: "Não autorizado. Faça login." });
  req.auth = data;
  next();
}
function optionalAuth(req, res, next) {
  const raw = req.header("Authorization") || "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    const data = tokens.get(token);
    if (data) req.auth = data;
  }
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Não autorizado." });
    if (req.auth.type !== role) return res.status(403).json({ error: "Acesso negado." });
    next();
  };
}
function parseSpecialties(val) {
  if (Array.isArray(val)) return val.filter(s => SPECIALTIES_LIST.includes(s));
  if (typeof val === "string") return val.split(",").map(s => s.trim()).filter(s => SPECIALTIES_LIST.includes(s));
  return [];
}

// ---------- DB INIT ----------
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS installers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      cpf TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      endereco TEXT NOT NULL,

      estado TEXT NOT NULL,
      cidade TEXT NOT NULL,

      telefone TEXT NOT NULL,
      whatsapp TEXT NOT NULL,

      especialidade TEXT NOT NULL,
      tipo_atendimento TEXT NOT NULL,   -- loja | domicilio | ambos

      documento_path TEXT NOT NULL,
      selfie_path TEXT NOT NULL,

      password_hash TEXT,              -- para login após aprovação

      status TEXT NOT NULL,            -- pending | approved | rejected
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      telefone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      estado TEXT NOT NULL,
      cidade TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      installer_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      installer_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (installer_id) REFERENCES installers(id),
      UNIQUE(user_id, installer_id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_installers_estado_cidade ON installers(estado, cidade);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_installers_status ON installers(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_interests_installer ON interests(installer_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_interests_user ON interests(user_id);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      installer_id INTEGER NOT NULL,
      uf TEXT NOT NULL,
      city TEXT NOT NULL,
      specialty_requested TEXT,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (installer_id) REFERENCES installers(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      price TEXT,
      eta TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_installer ON leads(installer_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);`);

  db.run("ALTER TABLE installers ADD COLUMN password_hash TEXT", (err) => {
    if (err && !String(err.message).includes("duplicate")) console.error("Migration:", err.message);
  });
  db.run("ALTER TABLE installers ADD COLUMN specialties TEXT", (err) => {
    if (err && !String(err.message).includes("duplicate")) console.error("Migration:", err.message);
    startServer();
  });
});

function startServer() {

// ---------- UPLOAD (multer) ----------
const storageDocs = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = Date.now() + "-" + Math.random().toString(16).slice(2);
    cb(null, base + ext);
  }
});
const storageSelfie = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SELFIES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = Date.now() + "-" + Math.random().toString(16).slice(2);
    cb(null, base + ext);
  }
});

function fileFilterDoc(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowed.includes(file.mimetype)) return cb(new Error("Documento inválido. Use JPG, PNG ou PDF."));
  cb(null, true);
}
function fileFilterSelfie(req, file, cb) {
  const allowed = ["image/jpeg", "image/png"];
  if (!allowed.includes(file.mimetype)) return cb(new Error("Selfie inválida. Use JPG ou PNG."));
  cb(null, true);
}

const uploadDocs = multer({ storage: storageDocs, fileFilter: fileFilterDoc, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadSelfie = multer({ storage: storageSelfie, fileFilter: fileFilterSelfie, limits: { fileSize: 5 * 1024 * 1024 } });

const upload = multer().fields([]); // não usado (só pra clareza)

// ---------- EMAIL ----------
async function sendPendingEmail(installerId, summary) {
  if (!GMAIL_APP_PASS) {
    console.log("⚠️  GMAIL_APP_PASS não configurado. Email não enviado.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS }
  });

  const adminLink = `http://localhost:${PORT}/admin.html`;

  const text =
`Novo instalador pendente de aprovação:

ID: ${installerId}
Nome: ${summary.nome}
Email: ${summary.email}
CPF: ${summary.cpf}
Nascimento: ${summary.data_nascimento}
Estado/Cidade: ${summary.estado}/${summary.cidade}
Telefone: ${summary.telefone}
WhatsApp: ${summary.whatsapp}
Especialidade: ${summary.especialidade}
Atendimento: ${summary.tipo_atendimento}

Painel admin:
${adminLink}
(Use a admin key no painel)`;


  await transporter.sendMail({
    from: `Instaladores de Rastreadores <${GMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `Instaladores de Rastreadores: novo instalador pendente (#${installerId})`,
    text
  });
}

// ---------- API PUBLIC ----------

// Estados com contagem (approved)
app.get("/api/states", (req, res) => {
  db.all(
    `SELECT estado as uf, COUNT(*) as total
     FROM installers
     WHERE status = 'approved'
     GROUP BY estado`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });

      const counts = Object.fromEntries(rows.map(r => [normalizeUF(r.uf), r.total]));
      const result = STATES.map(s => ({ uf: s.uf, name: s.name, total: counts[s.uf] || 0 }));
      res.json(result);
    }
  );
});

// ✅ cidades via backend (IBGE) — SEM CORS, SEM TRAVA
app.get("/api/ibge/cities", async (req, res) => {
  try {
    const uf = normalizeUF(req.query.uf);
    if (!isValidUF(uf)) return res.status(400).json({ error: "UF inválida." });

    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "IBGE indisponível." });

    const data = await r.json();
    const cities = data.map(m => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
    res.json(cities);
  } catch (e) {
    res.status(500).json({ error: "Falha ao buscar cidades." });
  }
});

// Cidades disponíveis (approved) para um UF
app.get("/api/cities", (req, res) => {
  const uf = normalizeUF(req.query.uf);
  if (!isValidUF(uf)) return res.status(400).json({ error: "UF inválida." });

  db.all(
    `SELECT cidade, COUNT(*) as total
     FROM installers
     WHERE status='approved' AND estado=?
     GROUP BY cidade
     ORDER BY cidade ASC`,
    [uf],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// ---------- LOCATIONS ----------
app.get("/api/locations/states", (req, res) => {
  res.json(STATES);
});

app.get("/api/locations/cities", async (req, res) => {
  try {
    const uf = normalizeUF(req.query.uf);
    if (!isValidUF(uf)) return res.status(400).json({ error: "UF inválida." });
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "IBGE indisponível." });
    const data = await r.json();
    const cities = data.map(m => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
    res.json(cities);
  } catch (e) {
    res.status(500).json({ error: "Falha ao buscar cidades." });
  }
});

// Listar instaladores approved por UF + cidade + especialidades (e busca opcional)
app.get("/api/installers", (req, res) => {
  const uf = normalizeUF(req.query.uf);
  const cidade = String(req.query.cidade || req.query.city || "").trim();
  const search = String(req.query.search || "").trim().toLowerCase();
  const specialtiesParam = String(req.query.specialties || "").trim();
  const requestedSpecs = specialtiesParam ? specialtiesParam.split(",").map(s => s.trim()).filter(Boolean) : [];

  if (!isValidUF(uf)) return res.status(400).json({ error: "UF inválida." });
  if (!cidade) return res.status(400).json({ error: "Cidade obrigatória." });

  const where = ["status='approved'", "estado = ?", "cidade = ?"];
  const params = [uf, cidade];

  if (requestedSpecs.length > 0) {
    const specClause = requestedSpecs.map(() => "(COALESCE(specialties,'') LIKE ? OR especialidade = ?)").join(" OR ");
    where.push(`(${specClause})`);
    requestedSpecs.forEach(s => {
      params.push(`%${s}%`, s);
    });
  }

  if (search) {
    where.push(`(
      LOWER(nome) LIKE ? OR
      LOWER(especialidade) LIKE ? OR
      LOWER(COALESCE(specialties,'')) LIKE ? OR
      LOWER(telefone) LIKE ? OR
      LOWER(whatsapp) LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  const sql = `SELECT id, nome, estado, cidade, telefone, whatsapp, especialidade, COALESCE(specialties, '[]') as specialties, tipo_atendimento
     FROM installers
     WHERE ${where.join(" AND ")}
     ORDER BY datetime(created_at) DESC`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    const out = (rows || []).map(r => ({
      ...r,
      specialties: (() => { try { return JSON.parse(r.specialties || "[]"); } catch (_) { return r.especialidade ? [r.especialidade] : []; } })()
    }));
    res.json(out);
  });
});

// Cadastro (pending) + upload documento+selfie + email
const uploadBoth = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "documento") return cb(null, UPLOADS_DIR);
      if (file.fieldname === "selfie") return cb(null, SELFIES_DIR);
      return cb(null, path.join(__dirname, "uploads"));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const base = Date.now() + "-" + Math.random().toString(16).slice(2);
      cb(null, base + ext);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "documento") return fileFilterDoc(req, file, cb);
    if (file.fieldname === "selfie") return fileFilterSelfie(req, file, cb);
    cb(new Error("Campo de arquivo inválido."));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
}).fields([{ name: "documento", maxCount: 1 }, { name: "selfie", maxCount: 1 }]);

app.post("/api/installers", uploadBoth, async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim();
    const cpf = onlyDigits(req.body.cpf);
    const data_nascimento = String(req.body.data_nascimento || "").trim();
    const endereco = String(req.body.endereco || "").trim();

    const estado = normalizeUF(req.body.estado);
    const cidade = String(req.body.cidade || "").trim();

    const telefone = String(req.body.telefone || "").trim();
    const whatsapp = toWhatsAppNumber(req.body.whatsapp || req.body.telefone);

    const tipo_atendimento = String(req.body.tipo_atendimento || "").trim();
    const senha = String(req.body.senha || "").trim();
    const specialtiesArr = parseSpecialties(req.body.specialties || req.body.especialidade);
    const especialidade = specialtiesArr.length ? specialtiesArr[0] : String(req.body.especialidade || "").trim();
    const specialtiesJson = JSON.stringify(specialtiesArr.length ? specialtiesArr : (req.body.especialidade ? [String(req.body.especialidade).trim()] : []));

    const docFile = req.files?.documento?.[0];
    const selfieFile = req.files?.selfie?.[0];
    if (!docFile) return res.status(400).json({ error: "Envie o documento (JPG/PNG/PDF)." });
    if (!selfieFile) return res.status(400).json({ error: "Envie a selfie (JPG/PNG)." });

    if (!nome || !email || !cpf || !data_nascimento || !endereco || !cidade || !telefone || !tipo_atendimento) {
      return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
    }
    if (specialtiesArr.length === 0 && !req.body.especialidade) return res.status(400).json({ error: "Selecione ao menos uma especialidade." });
    if (!isValidUF(estado)) return res.status(400).json({ error: "UF inválida." });
    if (cpf.length !== 11) return res.status(400).json({ error: "CPF inválido (precisa ter 11 dígitos)." });
    if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres (para login após aprovação)." });

    const documento_path = `/uploads/documents/${docFile.filename}`;
    const selfie_path = `/uploads/selfies/${selfieFile.filename}`;
    const createdAt = new Date().toISOString();
    const password_hash = hashPassword(senha);

    db.run(
      `INSERT INTO installers
       (nome, email, cpf, data_nascimento, endereco, estado, cidade, telefone, whatsapp, especialidade, tipo_atendimento, documento_path, selfie_path, password_hash, specialties, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [nome, email, cpf, data_nascimento, endereco, estado, cidade, telefone, whatsapp, especialidade, tipo_atendimento, documento_path, selfie_path, password_hash, specialtiesJson, createdAt],
      async function (err) {
        if (err) return res.status(500).json({ error: "DB error" });

        const id = this.lastID;
        sendPendingEmail(id, { nome, email, cpf, data_nascimento, estado, cidade, telefone, whatsapp, especialidade, tipo_atendimento })
          .catch(e => console.log("Email error:", e.message));

        res.json({ ok: true, id, estado, cidade, status: "pending" });
      }
    );
  } catch (e) {
    res.status(400).json({ error: e?.message || "Erro ao cadastrar." });
  }
});

// ---------- ADMIN ----------
app.get("/api/admin/installers/pending", optionalAuth, requireAdmin, (req, res) => {
  db.all(
    `SELECT * FROM installers WHERE status = 'pending' ORDER BY datetime(created_at) DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows || []);
    }
  );
});

app.get("/api/admin/installers", optionalAuth, requireAdmin, (req, res) => {
  const status = String(req.query.status || "").trim();
  const search = String(req.query.search || "").trim().toLowerCase();

  const where = [];
  const params = [];

  if (status) {
    where.push("status = ?");
    params.push(status);
  }

  if (search) {
    where.push(`(
      LOWER(nome) LIKE ? OR
      LOWER(cidade) LIKE ? OR
      LOWER(estado) LIKE ? OR
      LOWER(cpf) LIKE ? OR
      LOWER(especialidade) LIKE ? OR
      LOWER(status) LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  db.all(
    `SELECT * FROM installers ${clause} ORDER BY datetime(created_at) DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

app.post("/api/admin/installers/:id/approve", optionalAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const reviewedAt = new Date().toISOString();

  db.run(
    `UPDATE installers SET status='approved', reviewed_at=? WHERE id=?`,
    [reviewedAt, id],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      if (this.changes === 0) return res.status(404).json({ error: "Não encontrado" });
      res.json({ ok: true });
    }
  );
});

app.post("/api/admin/installers/:id/reject", optionalAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const reviewedAt = new Date().toISOString();

  db.run(
    `UPDATE installers SET status='rejected', reviewed_at=? WHERE id=?`,
    [reviewedAt, id],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      if (this.changes === 0) return res.status(404).json({ error: "Não encontrado" });
      res.json({ ok: true });
    }
  );
});

// ---------- CADASTRO DE USUÁRIO (cliente que precisa de instalação) ----------
const registerUser = (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const telefone = String(req.body.telefone || "").trim();
  const senha = String(req.body.senha || "").trim();
  const estado = normalizeUF(req.body.estado);
  const cidade = String(req.body.cidade || "").trim();

  if (!nome || !email || !telefone || !senha || !cidade) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }
  if (!isValidUF(estado)) return res.status(400).json({ error: "UF inválida." });
  if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres." });

  const password_hash = hashPassword(senha);
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO users (nome, email, telefone, password_hash, estado, cidade, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nome, email, telefone, password_hash, estado, cidade, createdAt],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "Este email já está cadastrado." });
        return res.status(500).json({ error: "Erro ao cadastrar." });
      }
      res.json({ ok: true, id: this.lastID });
    }
  );
};
app.post("/api/users", registerUser);
app.post("/api/auth/register-user", registerUser);

// ---------- LOGIN (usuário, instalador ou admin) ----------
app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "").trim();
  const tipo = String(req.body.tipo || req.body.role || "").trim(); // 'user' | 'installer' | 'admin'

  if (!email || !senha) return res.status(400).json({ error: "Email e senha obrigatórios." });

  if (tipo === "admin" || (tipo !== "user" && tipo !== "installer" && email === ADMIN_USER)) {
    if (ADMIN_USER && email === ADMIN_USER && senha === ADMIN_PASS) {
      const token = createToken("admin", 0);
      return res.json({ ok: true, token, role: "admin", tipo: "admin" });
    }
    if (tipo === "admin") return res.status(401).json({ error: "Credenciais de admin incorretas." });
  }

  if (tipo === "user") {
    db.get("SELECT id, password_hash FROM users WHERE email = ?", [email], (err, row) => {
      if (err) return res.status(500).json({ error: "Erro ao verificar login." });
      if (!row || !verifyPassword(senha, row.password_hash)) return res.status(401).json({ error: "Email ou senha incorretos." });
      const token = createToken("user", row.id);
      res.json({ ok: true, token, role: "user", tipo: "user", id: row.id });
    });
    return;
  }

  if (tipo === "installer") {
    db.get("SELECT id, password_hash, status FROM installers WHERE email = ?", [email], (err, row) => {
      if (err) return res.status(500).json({ error: "Erro ao verificar login." });
      if (!row) return res.status(401).json({ error: "Email ou senha incorretos." });
      if (row.status !== "approved") return res.status(403).json({ error: "Seu cadastro ainda não foi aprovado. Aguarde a aprovação para fazer login." });
      if (!row.password_hash || !verifyPassword(senha, row.password_hash)) return res.status(401).json({ error: "Email ou senha incorretos." });
      const token = createToken("installer", row.id);
      res.json({ ok: true, token, role: "installer", tipo: "installer", id: row.id });
    });
    return;
  }

  return res.status(400).json({ error: "Informe o tipo de conta: user, instalador ou admin." });
});

// Quem está logado (para o front redirecionar)
app.get("/api/me", authMiddleware, (req, res) => {
  const { type, id } = req.auth;
  if (type === "admin") return res.json({ tipo: "admin", role: "admin" });
  if (type === "user") {
    db.get("SELECT id, nome, email, estado, cidade FROM users WHERE id = ?", [id], (err, row) => {
      if (err || !row) return res.status(401).json({ error: "Sessão inválida." });
      res.json({ tipo: "user", id: row.id, nome: row.nome, email: row.email, estado: row.estado, cidade: row.cidade });
    });
    return;
  }
  db.get("SELECT id, nome, email, estado, cidade FROM installers WHERE id = ? AND status = 'approved'", [id], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Sessão inválida." });
    res.json({ tipo: "installer", id: row.id, nome: row.nome, email: row.email, estado: row.estado, cidade: row.cidade });
  });
});

// ---------- INTERESSES (usuário demonstra interesse em um instalador) ----------
app.post("/api/interests", authMiddleware, (req, res) => {
  if (req.auth.type !== "user") return res.status(403).json({ error: "Apenas usuários podem demonstrar interesse." });
  const installer_id = Number(req.body.installer_id);
  if (!installer_id) return res.status(400).json({ error: "installer_id obrigatório." });

  db.get("SELECT id FROM installers WHERE id = ? AND status = 'approved'", [installer_id], (err, inst) => {
    if (err || !inst) return res.status(400).json({ error: "Instalador não encontrado ou não aprovado." });
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO interests (user_id, installer_id, status, created_at) VALUES (?, ?, 'pending', ?)`,
      [req.auth.id, installer_id, createdAt],
      function (err) {
        if (err) return res.status(500).json({ error: "Erro ao registrar interesse." });
        if (this.changes === 0) return res.json({ ok: true, message: "Você já demonstrou interesse neste instalador." });
        res.json({ ok: true, id: this.lastID });
      }
    );
  });
});

// Instalador: lista de usuários que demonstraram interesse
app.get("/api/installer/interests", authMiddleware, (req, res) => {
  if (req.auth.type !== "installer") return res.status(403).json({ error: "Apenas instaladores." });
  db.all(
    `SELECT i.id, i.user_id, i.installer_message, i.status, i.created_at, i.updated_at,
            u.nome as user_nome, u.email as user_email, u.telefone as user_telefone, u.cidade as user_cidade, u.estado as user_estado
     FROM interests i
     JOIN users u ON u.id = i.user_id
     WHERE i.installer_id = ?
     ORDER BY i.created_at DESC`,
    [req.auth.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// Instalador: atualizar mensagem/valores/infos para um interesse
app.put("/api/installer/interests/:id", authMiddleware, (req, res) => {
  if (req.auth.type !== "installer") return res.status(403).json({ error: "Apenas instaladores." });
  const id = Number(req.params.id);
  const installer_message = String(req.body.installer_message || "").trim();
  const status = String(req.body.status || "").trim() || "answered";
  const updated_at = new Date().toISOString();

  db.run(
    `UPDATE interests SET installer_message = ?, status = ?, updated_at = ? WHERE id = ? AND installer_id = ?`,
    [installer_message, status, updated_at, id, req.auth.id],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      if (this.changes === 0) return res.status(404).json({ error: "Interesse não encontrado." });
      res.json({ ok: true });
    }
  );
});

// Usuário: lista de interesses que ele demonstrou (para mostrar status)
app.get("/api/user/interests", authMiddleware, (req, res) => {
  if (req.auth.type !== "user") return res.status(403).json({ error: "Apenas usuários." });
  db.all(
    `SELECT i.id, i.installer_id, i.status, i.installer_message, i.created_at, i.updated_at,
            inst.nome as installer_nome, inst.telefone, inst.whatsapp, inst.especialidade
     FROM interests i
     JOIN installers inst ON inst.id = i.installer_id
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC`,
    [req.auth.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// ---------- LEADS (novo fluxo) ----------
app.post("/api/leads", authMiddleware, requireRole("user"), (req, res) => {
  const installer_id = Number(req.body.installer_id);
  const uf = normalizeUF(req.body.uf);
  const city = String(req.body.city || req.body.cidade || "").trim();
  const specialty_requested = String(req.body.specialty_requested || "").trim();
  const details = String(req.body.details || "").trim();

  if (!installer_id || !isValidUF(uf) || !city) return res.status(400).json({ error: "installer_id, uf e city obrigatórios." });

  db.get("SELECT id FROM installers WHERE id = ? AND status = 'approved'", [installer_id], (err, inst) => {
    if (err || !inst) return res.status(400).json({ error: "Instalador não encontrado ou não aprovado." });
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO leads (user_id, installer_id, uf, city, specialty_requested, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [req.auth.id, installer_id, uf, city, specialty_requested, details, createdAt],
      function (err) {
        if (err) return res.status(500).json({ error: "Erro ao criar lead." });
        res.json({ ok: true, id: this.lastID });
      }
    );
  });
});

app.get("/api/installer/leads", authMiddleware, requireRole("installer"), (req, res) => {
  db.all(
    `SELECT l.id, l.user_id, l.uf, l.city, l.specialty_requested, l.details, l.status, l.created_at,
            u.nome as user_nome, u.email as user_email, u.telefone as user_telefone
     FROM leads l
     JOIN users u ON u.id = l.user_id
     WHERE l.installer_id = ?
     ORDER BY l.created_at DESC`,
    [req.auth.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      const ids = (rows || []).map(r => r.id);
      if (ids.length === 0) return res.json([]);
      db.all(
        `SELECT p.* FROM proposals p WHERE p.lead_id IN (${ids.map(() => "?").join(",")})`,
        ids,
        (err2, proposals) => {
          const byLead = (proposals || []).reduce((acc, p) => { acc[p.lead_id] = p; return acc; }, {});
          res.json((rows || []).map(r => ({ ...r, proposal: byLead[r.id] || null })));
        }
      );
    }
  );
});

app.post("/api/proposals", authMiddleware, requireRole("installer"), (req, res) => {
  const lead_id = Number(req.body.lead_id);
  const price = String(req.body.price || "").trim();
  const eta = String(req.body.eta || "").trim();
  const notes = String(req.body.notes || "").trim();
  if (!lead_id) return res.status(400).json({ error: "lead_id obrigatório." });

  db.get("SELECT id, installer_id FROM leads WHERE id = ?", [lead_id], (err, lead) => {
    if (err || !lead || lead.installer_id !== req.auth.id) return res.status(404).json({ error: "Lead não encontrado." });
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO proposals (lead_id, price, eta, notes, created_at) VALUES (?, ?, ?, ?, ?)`,
      [lead_id, price, eta, notes, createdAt],
      function (err) {
        if (err) return res.status(500).json({ error: "Erro ao enviar proposta." });
        db.run("UPDATE leads SET status = 'proposal_sent' WHERE id = ?", [lead_id]);
        res.json({ ok: true, id: this.lastID });
      }
    );
  });
});

app.get("/api/user/leads", authMiddleware, requireRole("user"), (req, res) => {
  db.all(
    `SELECT l.id, l.installer_id, l.uf, l.city, l.specialty_requested, l.details, l.status, l.created_at,
            i.nome as installer_nome, i.telefone as installer_telefone, i.whatsapp as installer_whatsapp
     FROM leads l
     JOIN installers i ON i.id = l.installer_id
     WHERE l.user_id = ?
     ORDER BY l.created_at DESC`,
    [req.auth.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      const leadIds = (rows || []).map(r => r.id);
      if (leadIds.length === 0) return res.json([]);
      const placeholders = leadIds.map(() => "?").join(",");
      db.all(`SELECT * FROM proposals WHERE lead_id IN (${placeholders})`, leadIds, (err2, proposals) => {
        const byLead = (proposals || []).reduce((acc, p) => { acc[p.lead_id] = (acc[p.lead_id] || []).concat(p); return acc; }, {});
        res.json((rows || []).map(r => ({ ...r, proposals: byLead[r.id] || [] })));
      });
    }
  );
});

  app.listen(PORT, () => {
    console.log(`Instaladores de Rastreadores: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin.html`);
    if (ADMIN_USER) console.log(`Admin login: ${ADMIN_USER}`);
    console.log(`Gmail sender: ${GMAIL_USER}`);
  });
}
