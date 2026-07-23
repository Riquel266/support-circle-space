const CACHE_NAME = "cuidarbem-v1";
const STATIC_ASSETS = [
  "/",
  "/auth",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  if (request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetched;
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-data") {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  const db = await openDB();
  const tx = db.transaction("pending-sync", "readonly");
  const store = tx.objectStore("pending-sync");
  const request = store.getAll();

  request.onsuccess = async () => {
    const items = request.result;
    for (const item of items) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.body),
        });
        const delTx = db.transaction("pending-sync", "readwrite");
        delTx.objectStore("pending-sync").delete(item.id);
      } catch {
        // keep for next sync
      }
    }
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("cuidarbem-offline", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pending-sync")) {
        db.createObjectStore("pending-sync", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
