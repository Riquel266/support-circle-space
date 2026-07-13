import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DB_FILE = join(import.meta.dir, "data.json");

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
      };
    }
  } catch (e) {
    console.error("readDb error:", e);
  }
  return { elders: [], caregivers: [], assignments: [], records: [], attendance: [] };
}

function writeDb(data: any) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function makeHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function ok(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: makeHeaders() });
}

function hashPassword(password: string): string {
  const bytes = new TextEncoder().encode(password + "cuidarbem_salt_v1");
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash.toString(16).padStart(8, "0");
}

const CAREGIVER_IPS = ["192.168.15.2"];

Bun.serve({
  port: 3001,
  async fetch(req, server) {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: makeHeaders() });
    }

    try {
      const db = readDb();

      if (pathname === "/api/role") {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || req.headers.get("x-real-ip")
          || server.requestIP(req)?.address
          || "unknown";
        const isCaregiver = CAREGIVER_IPS.includes(ip);
        return ok({ ip, role: isCaregiver ? "cuidador" : "supervisor" });
      }

      if (pathname === "/api/auth/login" && method === "POST") {
        const { email, password } = await req.json();
        if (!email || !password) return ok({ error: "Email e senha obrigatorios" }, 400);

        const hashed = hashPassword(password);
        const caregiver = db.caregivers.find((c: any) => c.email === email && c.password_hash === hashed);
        if (caregiver) {
          return ok({ user: { id: caregiver.id, full_name: caregiver.full_name, email: caregiver.email, role: "cuidador" } });
        }

        const supervisorEmail = "admin@cuidarbem.com";
        const supervisorPassword = "admin123";
        if (email === supervisorEmail && password === supervisorPassword) {
          return ok({ user: { id: "0e7874c3-a937-4158-a0ab-949991be81b9", full_name: "Supervisor", email, role: "supervisor" } });
        }

        return ok({ error: "Email ou senha invalidos" }, 401);
      }

      if (pathname === "/api/auth/signup" && method === "POST") {
        const { email, password, full_name } = await req.json();
        if (!email || !password || !full_name) return ok({ error: "Campos obrigatorios" }, 400);
        if (password.length < 6) return ok({ error: "Minimo 6 caracteres" }, 400);

        const existing = db.caregivers.find((c: any) => c.email === email);
        if (existing) return ok({ error: "Email ja cadastrado" }, 409);

        const newSupervisor = {
          id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
          full_name,
          email,
          password_hash: hashPassword(password),
          role: "supervisor",
          created_at: new Date().toISOString(),
        };
        return ok({ user: { id: newSupervisor.id, full_name, email, role: "supervisor" } });
      }

      if (pathname === "/api/elders") {
        if (method === "GET") return ok(db.elders);
        if (method === "POST") {
          const body = await req.json();
          db.elders.push(body);
          writeDb(db);
          return ok(body, 201);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            db.elders = db.elders.filter((e: any) => e.id !== id);
            writeDb(db);
          }
          return ok({ ok: true });
        }
      }

      if (pathname === "/api/caregivers") {
        if (method === "GET") return ok(db.caregivers);
        if (method === "POST") {
          const body = await req.json();
          if (body.password) {
            body.password_hash = hashPassword(body.password);
            delete body.password;
          }
          db.caregivers.push(body);
          writeDb(db);
          return ok(body, 201);
        }
      }

      if (pathname === "/api/assignments") {
        if (method === "GET") return ok(db.assignments);
        if (method === "POST") {
          const body = await req.json();
          const exists = db.assignments.some(
            (a: any) => a.caregiver_id === body.caregiver_id && a.elder_id === body.elder_id,
          );
          if (exists) return ok({ error: "Vinculo ja existe" }, 409);
          db.assignments.push(body);
          writeDb(db);
          return ok(body, 201);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            db.assignments = db.assignments.filter((a: any) => a.id !== id);
            writeDb(db);
          }
          return ok({ ok: true });
        }
      }

      if (pathname === "/api/records") {
        if (method === "GET") return ok(db.records);
        if (method === "POST") {
          const body = await req.json();
          db.records.push(body);
          writeDb(db);
          return ok(body, 201);
        }
      }

      if (pathname === "/api/attendance") {
        if (method === "GET") {
          const caregiverId = url.searchParams.get("caregiver_id");
          const date = url.searchParams.get("date");
          let list = db.attendance;
          if (caregiverId) list = list.filter((a: any) => a.caregiver_id === caregiverId);
          if (date) list = list.filter((a: any) => a.created_at.startsWith(date));
          return ok(list);
        }
        if (method === "POST") {
          const body = await req.json();
          db.attendance.push(body);
          writeDb(db);
          return ok(body, 201);
        }
        if (method === "PUT") {
          const body = await req.json();
          const idx = db.attendance.findIndex((a: any) => a.id === body.id);
          if (idx !== -1) {
            db.attendance[idx] = { ...db.attendance[idx], ...body };
            writeDb(db);
            return ok(db.attendance[idx]);
          }
          return ok({ error: "Not found" }, 404);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            db.attendance = db.attendance.filter((a: any) => a.id !== id);
            writeDb(db);
          }
          return ok({ ok: true });
        }
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error("Server error:", err);
      return ok({ error: "Internal server error" }, 500);
    }
  },
});

console.log("Database server running on http://localhost:3001");
