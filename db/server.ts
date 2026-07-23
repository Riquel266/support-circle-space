import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID, createHmac, randomBytes, pbkdf2Sync } from "crypto";

// ── Interfaces ──────────────────────────────────────────────────────

interface Elder {
  id: string;
  full_name: string;
  birth_date?: string;
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  photo_url?: string;
  notes?: string;
  created_at?: string;
}

interface Caregiver {
  id: string;
  full_name: string;
  email: string;
  password_hash?: string;
  role: "cuidador" | "supervisor";
  phone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  photo_url?: string;
  created_at?: string;
}

interface Assignment {
  id: string;
  caregiver_id: string;
  elder_id: string;
  created_at?: string;
}

interface Record {
  id: string;
  elder_id: string;
  caregiver_id: string;
  type: string;
  value?: string;
  notes?: string;
  photo_url?: string;
  lat?: number;
  lng?: number;
  created_at?: string;
}

interface Attendance {
  id: string;
  caregiver_id: string;
  elder_id?: string;
  type: "check_in" | "check_out";
  lat?: number;
  lng?: number;
  created_at?: string;
}

interface CompanyData {
  elders: Elder[];
  caregivers: Caregiver[];
  assignments: Assignment[];
  records: Record[];
  attendance: Attendance[];
  locations?: any[];
}

interface Subscription {
  plan: "trial" | "premium";
  status: "active" | "expired" | "inactive";
  trialStartedAt?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  paymentGateway?: string;
  gatewaySubscriptionId?: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  subscription?: Subscription;
}

interface CompaniesData {
  companies: Company[];
}

interface SuperAdmin {
  id: string;
  email: string;
  name: string;
  password: string;
}

// ── DB setup ────────────────────────────────────────────────────────

const DB_DIR = import.meta.dir;
const DB_FILE = join(DB_DIR, "data.json");
const SUPER_ADMIN_FILE = join(DB_DIR, "super-admin.json");
const COMPANIES_FILE = join(DB_DIR, "companies.json");
const COMPANIES_DIR = join(DB_DIR, "companies");

if (!existsSync(COMPANIES_DIR)) {
  mkdirSync(COMPANIES_DIR, { recursive: true });
}

// ── Input sanitization ──────────────────────────────────────────────

function sanitize(str: string): string {
  if (!str) return str;
  return str
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── DB helpers ──────────────────────────────────────────────────────

function readDb() {
  try {
    if (existsSync(DB_FILE)) {
      const data = JSON.parse(readFileSync(DB_FILE, "utf-8"));
      return {
        elders: data.elders || [],
        caregivers: data.caregivers || [],
        assignments: data.assignments || [],
        records: data.records || [],
        attendance: data.attendance || [],
        caregiver_locations: data.caregiver_locations || [],
      };
    }
  } catch (e) {
    console.error("readDb error:", e);
  }
  return { elders: [], caregivers: [], assignments: [], records: [], attendance: [], caregiver_locations: [] };
}

function writeDb(data: any) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function readSuperAdminData(): { admins: SuperAdmin[] } {
  try {
    if (existsSync(SUPER_ADMIN_FILE)) {
      return JSON.parse(readFileSync(SUPER_ADMIN_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("readSuperAdminData error:", e);
  }
  return { admins: [] };
}

function readCompaniesData(): CompaniesData {
  try {
    if (existsSync(COMPANIES_FILE)) {
      return JSON.parse(readFileSync(COMPANIES_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("readCompaniesData error:", e);
  }
  return { companies: [] };
}

function writeCompaniesData(data: CompaniesData) {
  writeFileSync(COMPANIES_FILE, JSON.stringify(data, null, 2));
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function readCompanyData(companyId: string): CompanyData {
  if (!isValidUUID(companyId)) {
    return { elders: [], caregivers: [], assignments: [], records: [], attendance: [], caregiver_locations: [] };
  }
  const filePath = join(COMPANIES_DIR, `${companyId}.json`);
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error("readCompanyData error:", e);
  }
  return { elders: [], caregivers: [], assignments: [], records: [], attendance: [], caregiver_locations: [] };
}

function writeCompanyData(companyId: string, data: CompanyData) {
  if (!isValidUUID(companyId)) return;
  const filePath = join(COMPANIES_DIR, `${companyId}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── Password hashing (PBKDF2) ─────────────────────────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) {
    const bytes = new TextEncoder().encode(password + "cuidarbem_salt_v1");
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return hash.toString(16).padStart(8, "0") === stored;
  }
  const [salt, hash] = stored.split(":");
  const test = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return test === hash;
}

function migratePassword(password: string, storedHash: string): string | null {
  if (!storedHash || storedHash.includes(":")) return null;
  if (verifyPassword(password, storedHash)) {
    return hashPassword(password);
  }
  return null;
}

// ── JWT ───────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required.");
  process.exit(1);
}

function createToken(payload: { id: string; role: string; companyId?: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token: string): { id: string; role: string; companyId?: string } | null {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Auth middleware ────────────────────────────────────────────────

function getAuthToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function requireAuth(req: Request): { id: string; role: string; companyId?: string } | null {
  const token = getAuthToken(req);
  if (!token) return null;
  return verifyToken(token);
}

function requireAdmin(req: Request): { id: string; role: string } | null {
  const user = requireAuth(req);
  if (!user || user.role !== "super_admin") return null;
  return user;
}

// ── Rate limiting ─────────────────────────────────────────────────

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= maxAttempts;
}

// ── Pending payments (simulated) ─────────────────────────────────

const pendingPayments = new Map<string, { companyId: string; createdAt: number }>();

// ── CORS ──────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = ["http://localhost:8080", "http://localhost:3001"];

function makeHeaders(req?: Request) {
  const origin = req?.headers?.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) || origin.includes("ngrok") || origin.includes("lovable") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Company-Id",
  };
}

function ok(body: any, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), { status, headers: makeHeaders(req) });
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address + ", Brasil");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { "User-Agent": "CuidarBem/1.0" } },
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocoding error:", e);
  }
  return null;
}

async function resolveLocation(body: any) {
  if (body.location_address && (!body.location_lat || !body.location_lng)) {
    const coords = await geocodeAddress(body.location_address);
    if (coords) {
      body.location_lat = coords.lat;
      body.location_lng = coords.lng;
    }
  }
}

// ── Subscription helpers ─────────────────────────────────────────

function getCompanySubscription(companyId: string | null): Subscription | null {
  if (!companyId) return null;
  const companiesData = readCompaniesData();
  const company = companiesData.companies.find((c) => c.id === companyId);
  if (!company) return null;
  return company.subscription || null;
}

function isLocationAllowed(companyId: string | null): boolean {
  if (!companyId) return false;
  const sub = getCompanySubscription(companyId);
  if (!sub) return false;
  if (sub.plan === "trial") {
    return sub.status === "active" && sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date();
  }
  return sub.status === "active";
}

function updateCompanySubscription(companyId: string, update: Partial<Subscription>): void {
  const companiesData = readCompaniesData();
  const idx = companiesData.companies.findIndex((c) => c.id === companyId);
  if (idx === -1) return;
  companiesData.companies[idx].subscription = {
    ...companiesData.companies[idx].subscription,
    ...update,
  };
  writeCompaniesData(companiesData);
}

function createTrialSubscription(): Subscription {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 30 * 86400000);
  return {
    plan: "trial",
    status: "active",
    trialStartedAt: now.toISOString(),
    trialEndsAt: endsAt.toISOString(),
    paymentGateway: undefined,
    gatewaySubscriptionId: undefined,
    currentPeriodStart: undefined,
    currentPeriodEnd: undefined,
  };
}

const CAREGIVER_IPS = ["192.168.15.2"];

function getCompanyIdFromRequest(req: Request, user?: { companyId?: string } | null): string | null {
  if (user?.companyId) return user.companyId;
  return req.headers.get("X-Company-Id");
}

Bun.serve({
  port: 3001,
  async fetch(req, server) {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: makeHeaders(req) });
    }

    try {
      // ── Admin routes ──────────────────────────────────────────────

      if (pathname === "/api/admin/login" && method === "POST") {
        const { email, password } = await req.json();
        if (!email || !password) return ok({ error: "Email e senha obrigatorios" }, 400, req);
        if (password.length < 6) return ok({ error: "Senha deve ter pelo menos 6 caracteres" }, 400, req);

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || req.headers.get("x-real-ip")
          || server.requestIP(req)?.address
          || "unknown";
        if (!checkRateLimit(`admin_login:${ip}`, 5, 60_000)) {
          return ok({ error: "Muitas tentativas. Tente novamente em 1 minuto." }, 429, req);
        }

        const adminData = readSuperAdminData();
        const admin = adminData.admins.find((a) => a.email === email && verifyPassword(password, a.password));
        if (!admin) return ok({ error: "Email ou senha invalidos" }, 401, req);

        const token = createToken({ id: admin.id, role: "super_admin" });
        return ok({
          token,
          admin: { id: admin.id, email: admin.email, name: admin.name },
        }, 200, req);
      }

      if (pathname === "/api/admin/companies" && method === "GET") {
        const admin = requireAdmin(req);
        if (!admin) return ok({ error: "Unauthorized" }, 401, req);
        const companiesData = readCompaniesData();
        return ok(companiesData, 200, req);
      }

      if (pathname === "/api/admin/companies" && method === "POST") {
        const admin = requireAdmin(req);
        console.log("POST /api/admin/companies - auth header:", req.headers.get("Authorization")?.substring(0, 30), "admin:", admin);
        if (!admin) return ok({ error: "Unauthorized" }, 401, req);
        const body = await req.json();
        const companyName = body.name || body.company?.name;
        const companySlug = body.slug || body.company?.slug;
        const supervisorEmail = body.supervisor?.email;
        const supervisorName = body.supervisor?.full_name || body.supervisor?.name || "Supervisor";
        const supervisorPassword = body.supervisor?.password;

        if (!companyName) return ok({ error: "Nome da empresa e obrigatorio" }, 400, req);

        const companyId = randomUUID();
        const companiesData = readCompaniesData();
        companiesData.companies.push({
          id: companyId,
          name: sanitize(companyName),
          slug: companySlug || companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          active: true,
          createdAt: new Date().toISOString(),
          subscription: createTrialSubscription(),
        });
        writeCompaniesData(companiesData);

        const emptyData: CompanyData = {
          elders: [],
          caregivers: [],
          assignments: [],
          records: [],
          attendance: [],
          caregiver_locations: [],
        };

        if (supervisorEmail && supervisorPassword) {
          emptyData.caregivers.push({
            id: randomUUID(),
            full_name: sanitize(supervisorName),
            email: supervisorEmail,
            phone: null,
            role: "supervisor",
            password_hash: hashPassword(supervisorPassword),
            photo_url: null,
            created_at: new Date().toISOString(),
          });
        }

        writeCompanyData(companyId, emptyData);

        const created = companiesData.companies[companiesData.companies.length - 1];
        return ok({ company: created, companyId }, 201, req);
      }

      if (pathname.startsWith("/api/admin/companies/") && method === "PATCH") {
        const admin = requireAdmin(req);
        if (!admin) return ok({ error: "Unauthorized" }, 401, req);
        const parts = pathname.split("/");
        const companyId = parts[parts.length - 1];
        if (!companyId || !isValidUUID(companyId)) return ok({ error: "Invalid company ID" }, 400, req);

        const body = await req.json();
        const companiesData = readCompaniesData();
        const idx = companiesData.companies.findIndex((c) => c.id === companyId);
        if (idx === -1) return ok({ error: "Empresa nao encontrada" }, 404, req);

        if (body.active !== undefined) {
          companiesData.companies[idx].active = body.active;
        }
        if (body.name !== undefined) {
          companiesData.companies[idx].name = sanitize(body.name);
        }
        if (body.slug !== undefined) {
          companiesData.companies[idx].slug = body.slug;
        }

        writeCompaniesData(companiesData);
        return ok(companiesData.companies[idx], 200, req);
      }

      // ── Role (unchanged) ─────────────────────────────────────────

      if (pathname === "/api/role") {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || req.headers.get("x-real-ip")
          || server.requestIP(req)?.address
          || "unknown";
        const isCaregiver = CAREGIVER_IPS.includes(ip);
        return ok({ ip, role: isCaregiver ? "cuidador" : "supervisor" }, 200, req);
      }

      // ── Auth routes ──────────────────────────────────────────────

      if (pathname === "/api/auth/login" && method === "POST") {
        const { email, password, companySlug } = await req.json();
        if (!email || !password) return ok({ error: "Email e senha obrigatorios" }, 400, req);
        if (password.length < 6) return ok({ error: "Senha deve ter pelo menos 6 caracteres" }, 400, req);

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || req.headers.get("x-real-ip")
          || server.requestIP(req)?.address
          || "unknown";
        if (!checkRateLimit(`auth_login:${ip}`, 5, 60_000)) {
          return ok({ error: "Muitas tentativas. Tente novamente em 1 minuto." }, 429, req);
        }

        if (companySlug) {
          const companiesData = readCompaniesData();
          const company = companiesData.companies.find((c) => c.slug === companySlug && c.active);
          if (!company) {
            return ok({ error: "Empresa nao encontrada ou inativa" }, 404, req);
          }
          const companyDb = readCompanyData(company.id);
          const caregiver = companyDb.caregivers.find((c) => c.email === email && verifyPassword(password, c.password_hash || ""));
          if (caregiver) {
            const newHash = migratePassword(password, caregiver.password_hash || "");
            if (newHash) {
              caregiver.password_hash = newHash;
              writeCompanyData(company.id, companyDb);
            }
            const token = createToken({ id: caregiver.id, role: caregiver.role || "cuidador", companyId: company.id });
            return ok({
              token,
              user: { id: caregiver.id, full_name: caregiver.full_name, email: caregiver.email, role: caregiver.role || "cuidador" },
              companyId: company.id,
            }, 200, req);
          }
          return ok({ error: "Email ou senha invalidos" }, 401, req);
        }

        const db = readDb();
        const caregiver = db.caregivers.find((c: any) => c.email === email && verifyPassword(password, c.password_hash));
        if (caregiver) {
          const newHash = migratePassword(password, caregiver.password_hash);
          if (newHash) {
            caregiver.password_hash = newHash;
            writeDb(db);
          }
          const token = createToken({ id: caregiver.id, role: caregiver.role || "cuidador" });
          return ok({
            token,
            user: { id: caregiver.id, full_name: caregiver.full_name, email: caregiver.email, role: caregiver.role || "cuidador" },
          }, 200, req);
        }

        return ok({ error: "Email ou senha invalidos" }, 401, req);
      }

      if (pathname === "/api/auth/signup" && method === "POST") {
        return ok({ error: "Cadastro desabilitado. Fale com o administrador." }, 403, req);
      }

      if (pathname === "/api/auth/validate" && method === "POST") {
        const authUser = requireAuth(req);
        if (!authUser) {
          const { userId, role } = await req.json();
          const cid = req.headers.get("X-Company-Id");
          if (cid) {
            if (!isValidUUID(cid)) return ok({ valid: false }, 400, req);
            const companyDb = readCompanyData(cid);
            if (role === "supervisor") {
              const valid = companyDb.caregivers.some((c) => c.id === userId && c.role === "supervisor");
              return ok({ valid }, 200, req);
            }
            const exists = companyDb.caregivers.some((c) => c.id === userId);
            return ok({ valid: exists }, 200, req);
          }
          const db = readDb();
          if (role === "supervisor") {
            const validSupervisor = db.caregivers.some((c: any) => c.id === userId && c.role === "supervisor");
            return ok({ valid: validSupervisor }, 200, req);
          }
          const exists = db.caregivers.some((c: any) => c.id === userId);
          return ok({ valid: exists }, 200, req);
        }
        if (authUser.companyId) {
          if (!isValidUUID(authUser.companyId)) return ok({ valid: false }, 400, req);
          const companyDb = readCompanyData(authUser.companyId);
          if (authUser.role === "supervisor") {
            const valid = companyDb.caregivers.some((c) => c.id === authUser.id && c.role === "supervisor");
            return ok({ valid }, 200, req);
          }
          const exists = companyDb.caregivers.some((c) => c.id === authUser.id);
          return ok({ valid: exists }, 200, req);
        }
        const db = readDb();
        if (authUser.role === "supervisor") {
          const validSupervisor = db.caregivers.some((c: any) => c.id === authUser.id && c.role === "supervisor");
          return ok({ valid: validSupervisor }, 200, req);
        }
        const exists = db.caregivers.some((c: any) => c.id === authUser.id);
        return ok({ valid: exists }, 200, req);
      }

      // ── Company-scoped data routes ───────────────────────────────

      const dataRoutes = [
        "/api/elders", "/api/caregivers", "/api/assignments",
        "/api/records", "/api/attendance", "/api/caregiver-locations",
        "/api/caregiver-locations/",
      ];
      const isDataRoute = dataRoutes.some((r) => pathname === r || (r.endsWith("/") && pathname.startsWith(r)));

      let companyId: string | null = null;
      if (isDataRoute) {
        const user = requireAuth(req);
        if (!user) return ok({ error: "Unauthorized" }, 401, req);
        companyId = getCompanyIdFromRequest(req, user);
        if (companyId && !isValidUUID(companyId)) return ok({ error: "Invalid company ID" }, 400, req);
      }

      function useDb(companyId: string | null): CompanyData {
        if (companyId) return readCompanyData(companyId);
        return readDb();
      }
      function saveDb(companyId: string | null, data: CompanyData) {
        if (companyId) writeCompanyData(companyId, data);
        else writeDb(data);
      }

      if (pathname === "/api/elders") {
        const companyDb = useDb(companyId);
        if (method === "GET") return ok(companyDb.elders, 200, req);
        if (method === "POST") {
          const rlKey = `create_elder:${companyId || "anon"}`;
          if (!checkRateLimit(rlKey, 5, 60_000)) return ok({ error: "Rate limit exceeded" }, 429, req);
          const body = await req.json();
          if (body.full_name) body.full_name = sanitize(body.full_name);
          if (body.address) body.address = sanitize(body.address);
          if (body.phone) body.phone = sanitize(body.phone);
          if (body.notes) body.notes = sanitize(body.notes);
          await resolveLocation(body);
          companyDb.elders.push(body);
          saveDb(companyId, companyDb);
          return ok(body, 201, req);
        }
        if (method === "PUT") {
          const body = await req.json();
          if (body.full_name) body.full_name = sanitize(body.full_name);
          if (body.address) body.address = sanitize(body.address);
          if (body.phone) body.phone = sanitize(body.phone);
          if (body.notes) body.notes = sanitize(body.notes);
          await resolveLocation(body);
          const idx = companyDb.elders.findIndex((e) => e.id === body.id);
          if (idx !== -1) {
            companyDb.elders[idx] = { ...companyDb.elders[idx], ...body };
            saveDb(companyId, companyDb);
            return ok(companyDb.elders[idx], 200, req);
          }
          return ok({ error: "Not found" }, 404, req);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            companyDb.elders = companyDb.elders.filter((e) => e.id !== id);
            saveDb(companyId, companyDb);
          }
          return ok({ ok: true }, 200, req);
        }
      }

      if (pathname === "/api/caregivers") {
        const companyDb = useDb(companyId);
        if (method === "GET") return ok(companyDb.caregivers, 200, req);
        if (method === "POST") {
          const rlKey = `create_caregiver:${companyId || "anon"}`;
          if (!checkRateLimit(rlKey, 5, 60_000)) return ok({ error: "Rate limit exceeded" }, 429, req);
          const body = await req.json();
          if (body.full_name) body.full_name = sanitize(body.full_name);
          if (body.phone) body.phone = sanitize(body.phone);
          if (body.address) body.address = sanitize(body.address);
          if (body.password) {
            body.password_hash = hashPassword(body.password);
            delete body.password;
          }
          await resolveLocation(body);
          companyDb.caregivers.push(body);
          saveDb(companyId, companyDb);
          return ok(body, 201, req);
        }
        if (method === "PUT") {
          const body = await req.json();
          const idx = companyDb.caregivers.findIndex((c) => c.id === body.id);
          if (idx !== -1) {
            if (body.full_name) body.full_name = sanitize(body.full_name);
            if (body.phone) body.phone = sanitize(body.phone);
            if (body.address) body.address = sanitize(body.address);
            if (body.password) {
              body.password_hash = hashPassword(body.password);
              delete body.password;
            } else {
              delete body.password;
            }
            await resolveLocation(body);
            companyDb.caregivers[idx] = { ...companyDb.caregivers[idx], ...body };
            saveDb(companyId, companyDb);
            return ok(companyDb.caregivers[idx], 200, req);
          }
          return ok({ error: "Not found" }, 404, req);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            companyDb.caregivers = companyDb.caregivers.filter((c) => c.id !== id);
            companyDb.assignments = companyDb.assignments.filter((a) => a.caregiver_id !== id);
            saveDb(companyId, companyDb);
          }
          return ok({ ok: true }, 200, req);
        }
      }

      if (pathname === "/api/assignments") {
        const companyDb = useDb(companyId);
        if (method === "GET") return ok(companyDb.assignments, 200, req);
        if (method === "POST") {
          const body = await req.json();
          const exists = companyDb.assignments.some(
            (a) => a.caregiver_id === body.caregiver_id && a.elder_id === body.elder_id,
          );
          if (exists) return ok({ error: "Vinculo ja existe" }, 409, req);
          companyDb.assignments.push(body);
          saveDb(companyId, companyDb);
          return ok(body, 201, req);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            companyDb.assignments = companyDb.assignments.filter((a) => a.id !== id);
            saveDb(companyId, companyDb);
          }
          return ok({ ok: true }, 200, req);
        }
      }

      if (pathname === "/api/records") {
        const companyDb = useDb(companyId);
        if (method === "GET") return ok(companyDb.records, 200, req);
        if (method === "POST") {
          const rlKey = `create_record:${companyId || "anon"}`;
          if (!checkRateLimit(rlKey, 10, 60_000)) return ok({ error: "Rate limit exceeded" }, 429, req);
          const body = await req.json();
          companyDb.records.push(body);
          saveDb(companyId, companyDb);
          return ok(body, 201, req);
        }
      }

      if (pathname === "/api/attendance") {
        const companyDb = useDb(companyId);
        if (method === "GET") {
          const caregiverId = url.searchParams.get("caregiver_id");
          const date = url.searchParams.get("date");
          let list = companyDb.attendance;
          if (caregiverId) list = list.filter((a) => a.caregiver_id === caregiverId);
          if (date) list = list.filter((a) => a.created_at && a.created_at.startsWith(date));
          return ok(list, 200, req);
        }
        if (method === "POST") {
          const rlKey = `create_attendance:${companyId || "anon"}`;
          if (!checkRateLimit(rlKey, 10, 60_000)) return ok({ error: "Rate limit exceeded" }, 429, req);
          const body = await req.json();
          companyDb.attendance.push(body);
          saveDb(companyId, companyDb);
          return ok(body, 201, req);
        }
        if (method === "PUT") {
          const body = await req.json();
          const idx = companyDb.attendance.findIndex((a) => a.id === body.id);
          if (idx !== -1) {
            companyDb.attendance[idx] = { ...companyDb.attendance[idx], ...body };
            saveDb(companyId, companyDb);
            return ok(companyDb.attendance[idx], 200, req);
          }
          return ok({ error: "Not found" }, 404, req);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            companyDb.attendance = companyDb.attendance.filter((a) => a.id !== id);
            saveDb(companyId, companyDb);
          }
          return ok({ ok: true }, 200, req);
        }
      }

      if (pathname === "/api/caregiver-locations") {
        const companyDb = useDb(companyId);
        if (method === "GET") {
          if (!isLocationAllowed(companyId)) {
            const sub = getCompanySubscription(companyId);
            return ok({
              error: "Localizacao e um recurso premium. Ative seu plano para acessar.",
              requiresUpgrade: true,
              subscription: sub,
            }, 403, req);
          }
          const caregiverId = url.searchParams.get("caregiver_id");
          let list = companyDb.caregiver_locations || [];
          if (caregiverId) {
            list = list.filter((l: any) => l.caregiver_id === caregiverId);
          } else {
            const latest: any[] = [];
            for (const loc of list) {
              const idx = latest.findIndex((l: any) => l.caregiver_id === loc.caregiver_id);
              if (idx === -1 || new Date(loc.updated_at).getTime() > new Date(latest[idx].updated_at).getTime()) {
                if (idx !== -1) latest[idx] = loc;
                else latest.push(loc);
              }
            }
            return ok(latest, 200, req);
          }
          return ok(list, 200, req);
        }
        if (method === "POST") {
          const body = await req.json();
          if (!companyDb.caregiver_locations) companyDb.caregiver_locations = [];
          const idx = companyDb.caregiver_locations.findIndex((l: any) => l.caregiver_id === body.caregiver_id);
          const entry = {
            caregiver_id: body.caregiver_id,
            lat: body.lat,
            lng: body.lng,
            updated_at: new Date().toISOString(),
          };
          if (idx !== -1) {
            companyDb.caregiver_locations[idx] = entry;
          } else {
            companyDb.caregiver_locations.push(entry);
          }
          saveDb(companyId, companyDb);
          return ok(entry, 201, req);
        }
      }

      // ── Subscription routes ────────────────────────────────────────

      if (pathname.startsWith("/api/subscription/") && method === "GET") {
        const parts = pathname.split("/");
        const subCompanyId = parts[3];
        if (!subCompanyId || !isValidUUID(subCompanyId)) return ok({ error: "Invalid company ID" }, 400, req);
        const sub = getCompanySubscription(subCompanyId);
        if (!sub) return ok({ error: "Empresa nao encontrada" }, 404, req);
        return ok({
          ...sub,
          locationAllowed: isLocationAllowed(subCompanyId),
        }, 200, req);
      }

      if (pathname === "/api/subscription/create-checkout" && method === "POST") {
        const { companyId: cid, priceId } = await req.json();
        if (!cid || !isValidUUID(cid)) return ok({ error: "companyId required" }, 400, req);

        const sub = getCompanySubscription(cid);
        if (!sub) return ok({ error: "Empresa nao encontrada" }, 404, req);
        if (sub.plan === "premium" && sub.status === "active") return ok({ error: "Ja esta no plano premium" }, 400, req);

        const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
        if (STRIPE_KEY) {
          const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${STRIPE_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              "payment_method_types[0]": "card",
              "mode": "subscription",
              "line_items[0][price]": priceId || "price_premium_monthly",
              "line_items[0][quantity]": "1",
              "success_url": `${req.headers.get("origin") || "http://localhost:8080"}/billing?checkout=success`,
              "cancel_url": `${req.headers.get("origin") || "http://localhost:8080"}/billing?checkout=cancelled`,
              "metadata[companyId]": cid,
            }).toString(),
          });
          const session = await resp.json();
          if (session.url) return ok({ url: session.url }, 200, req);
          return ok({ error: session.error?.message || "Erro ao criar sessao Stripe" }, 400, req);
        }

        const baseUrl = req.headers.get("origin") || "http://localhost:8080";
        const simulateToken = randomBytes(16).toString("hex");
        pendingPayments.set(simulateToken, { companyId: cid, createdAt: Date.now() });
        return ok({ url: `${baseUrl}/simulate-checkout?token=${simulateToken}` }, 200, req);
      }

      if (pathname === "/api/subscription/webhook" && method === "POST") {
        const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
        const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
        if (!STRIPE_KEY || !STRIPE_WEBHOOK_SECRET) return ok({ error: "Stripe not configured" }, 400, req);

        const sig = req.headers.get("stripe-signature");
        const rawBody = await req.text();
        if (!sig) return ok({ error: "Missing signature" }, 400, req);

        const parts = sig.split(",").reduce((acc: any, part) => {
          const [key, val] = part.split("=");
          acc[key] = val;
          return acc;
        }, {});

        const timestamp = parts["t"];
        const signature = parts["v1"];
        const signedPayload = `${timestamp}.${rawBody}`;
        const expected = createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(signedPayload).digest("hex");

        if (signature !== expected) return ok({ error: "Invalid signature" }, 400, req);

        const event = JSON.parse(rawBody);
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const cid = session.metadata?.companyId;
          const subscriptionId = session.subscription;
          if (cid && isValidUUID(cid)) {
            updateCompanySubscription(cid, {
              plan: "premium",
              status: "active",
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: session.customer,
              currentPeriodEnd: new Date(session.subscription_current_period_end * 1000).toISOString(),
            });
          }
        }
        if (event.type === "customer.subscription.deleted") {
          const sub = event.data.object;
          const companiesData = readCompaniesData();
          const company = companiesData.companies.find((c) => c.subscription?.stripeSubscriptionId === sub.id);
          if (company) {
            updateCompanySubscription(company.id, {
              plan: "trial",
              status: "expired",
              currentPeriodEnd: undefined,
            });
          }
        }
        return ok({ received: true }, 200, req);
      }

      if (pathname === "/api/subscription/simulate-pay" && method === "POST") {
        const { token: payToken } = await req.json();
        if (!payToken) return ok({ error: "token required" }, 400, req);

        const pending = pendingPayments.get(payToken);
        if (!pending) return ok({ error: "Token invalido ou expirado" }, 400, req);

        const age = Date.now() - pending.createdAt;
        if (age > 5 * 60 * 1000) {
          pendingPayments.delete(payToken);
          return ok({ error: "Token expirado" }, 400, req);
        }

        pendingPayments.delete(payToken);
        updateCompanySubscription(pending.companyId, {
          plan: "premium",
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        });

        return ok({ success: true, message: "Pagamento confirmado! Plano premium ativado." }, 200, req);
      }

      // ── Admin subscription management ──────────────────────────────

      if (pathname.startsWith("/api/admin/companies/") && method === "DELETE") {
        const admin = requireAdmin(req);
        if (!admin) return ok({ error: "Unauthorized" }, 401, req);
        const parts = pathname.split("/");
        const deleteCompanyId = parts[4];
        if (!deleteCompanyId || !isValidUUID(deleteCompanyId)) return ok({ error: "Invalid company ID" }, 400, req);
        const companiesData = readCompaniesData();
        const idx = companiesData.companies.findIndex((c) => c.id === deleteCompanyId);
        if (idx === -1) return ok({ error: "Empresa nao encontrada" }, 404, req);
        companiesData.companies.splice(idx, 1);
        writeFileSync(join(DB_DIR, "companies.json"), JSON.stringify(companiesData, null, 2));
        const companyFile = join(COMPANIES_DIR, `${deleteCompanyId}.json`);
        if (existsSync(companyFile)) {
          unlinkSync(companyFile);
        }
        return ok({ success: true }, 200, req);
      }

      if (pathname.startsWith("/api/admin/companies/") && pathname.endsWith("/subscription") && method === "PATCH") {
        const admin = requireAdmin(req);
        if (!admin) return ok({ error: "Unauthorized" }, 401, req);
        const parts = pathname.split("/");
        const targetCompanyId = parts[4];
        if (!targetCompanyId || !isValidUUID(targetCompanyId)) return ok({ error: "Invalid company ID" }, 400, req);

        const body = await req.json();
        if (body.action === "extend_trial") {
          const sub = getCompanySubscription(targetCompanyId);
          if (!sub) return ok({ error: "Empresa nao encontrada" }, 404, req);
          const currentEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : new Date();
          const newEnd = new Date(currentEnd.getTime() + (body.days || 30) * 86400000);
          updateCompanySubscription(targetCompanyId, {
            trialEndsAt: newEnd.toISOString(),
            status: "active",
          });
          return ok({ success: true, trialEndsAt: newEnd.toISOString() }, 200, req);
        }
        if (body.action === "set_plan") {
          updateCompanySubscription(targetCompanyId, {
            plan: body.plan || "premium",
            status: body.status || "active",
            currentPeriodEnd: body.currentPeriodEnd || undefined,
          });
          return ok({ success: true }, 200, req);
        }
        if (body.action === "reset_trial") {
          updateCompanySubscription(targetCompanyId, createTrialSubscription());
          return ok({ success: true }, 200, req);
        }
        return ok({ error: "Unknown action" }, 400, req);
      }

      return new Response("Not found", { status: 404 });
    } catch (err: any) {
      console.error("Server error:", err);
      return ok({ error: "Internal server error" }, 500, req);
    }
  },
});

console.log("Database server running on http://localhost:3001");
console.log("Admin API ready");
console.log("Multi-tenant API ready");
