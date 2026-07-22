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
          return ok({ user: { id: caregiver.id, full_name: caregiver.full_name, email: caregiver.email, role: caregiver.role || "cuidador" } });
        }

        const supervisorEmail = "admin@cuidarbem.com";
        const supervisorPassword = "admin123";
        if (email === supervisorEmail && password === supervisorPassword) {
          return ok({ user: { id: "0e7874c3-a937-4158-a0ab-949991be81b9", full_name: "Supervisor", email, role: "supervisor" } });
        }

        return ok({ error: "Email ou senha invalidos" }, 401);
      }

      if (pathname === "/api/auth/signup" && method === "POST") {
        return ok({ error: "Cadastro desabilitado. Fale com o administrador." }, 403);
      }

      if (pathname === "/api/auth/validate" && method === "POST") {
        const { userId, role } = await req.json();
        if (role === "supervisor") {
          const validSupervisor = userId === "0e7874c3-a937-4158-a0ab-949991be81b9" || db.caregivers.some((c: any) => c.id === userId && c.role === "supervisor");
          return ok({ valid: validSupervisor });
        }
        const exists = db.caregivers.some((c: any) => c.id === userId);
        return ok({ valid: exists });
      }

      if (pathname === "/api/elders") {
        if (method === "GET") return ok(db.elders);
        if (method === "POST") {
          const body = await req.json();
          await resolveLocation(body);
          db.elders.push(body);
          writeDb(db);
          return ok(body, 201);
        }
        if (method === "PUT") {
          const body = await req.json();
          await resolveLocation(body);
          const idx = db.elders.findIndex((e: any) => e.id === body.id);
          if (idx !== -1) {
            db.elders[idx] = { ...db.elders[idx], ...body };
            writeDb(db);
            return ok(db.elders[idx]);
          }
          return ok({ error: "Not found" }, 404);
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
          await resolveLocation(body);
          db.caregivers.push(body);
          writeDb(db);
          return ok(body, 201);
        }
        if (method === "PUT") {
          const body = await req.json();
          const idx = db.caregivers.findIndex((c: any) => c.id === body.id);
          if (idx !== -1) {
            if (body.password) {
              body.password_hash = hashPassword(body.password);
              delete body.password;
            } else {
              delete body.password;
            }
            await resolveLocation(body);
            db.caregivers[idx] = { ...db.caregivers[idx], ...body };
            writeDb(db);
            return ok(db.caregivers[idx]);
          }
          return ok({ error: "Not found" }, 404);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id) {
            db.caregivers = db.caregivers.filter((c: any) => c.id !== id);
            db.assignments = db.assignments.filter((a: any) => a.caregiver_id !== id);
            writeDb(db);
          }
          return ok({ ok: true });
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

      if (pathname === "/api/caregiver-locations") {
        if (method === "GET") {
          const caregiverId = url.searchParams.get("caregiver_id");
          let list = db.caregiver_locations || [];
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
            return ok(latest);
          }
          return ok(list);
        }
        if (method === "POST") {
          const body = await req.json();
          if (!db.caregiver_locations) db.caregiver_locations = [];
          const idx = db.caregiver_locations.findIndex((l: any) => l.caregiver_id === body.caregiver_id);
          const entry = {
            caregiver_id: body.caregiver_id,
            lat: body.lat,
            lng: body.lng,
            updated_at: new Date().toISOString(),
          };
          if (idx !== -1) {
            db.caregiver_locations[idx] = entry;
          } else {
            db.caregiver_locations.push(entry);
          }
          writeDb(db);
          return ok(entry, 201);
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
