const CACHE_NAME = "Buses-BLGD-v2";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./style.json",
  "./balangoda.pmtiles",
  "./sw.js",
  "./lib/maplibre-gl.js",
  "./lib/maplibre-gl.css",
  "./lib/pmtiles.js",
  "./lib/turf.min.js",
  "./images/icon.png",
  "./images/hero.png",
  "./images/bus.png",
  "./images/map.png",
  "./images/saved.png",
  "./Images/map-marker-alt.svg",
  "./images/settings.svg",
  "./Images/screenshot1.png",
  "./Images/screenshot1.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.headers.has("range")) {
    event.respondWith(handleRangeRequest(request));
    return;
  }
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(request).catch(
          () => new Response("Offline resource unavailable", { status: 503 }),
        )
      );
    }),
  );
});

async function handleRangeRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  let cachedResponse = await cache.match(request, { ignoreSearch: true });

  if (!cachedResponse) {
    try {
      cachedResponse = await fetch(request);
    } catch (e) {
      return new Response("", {
        status: 404,
        statusText: "Offline File Not Found",
      });
    }
  }

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const rangeHeader = request.headers.get("range");
  const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/);

  if (!match) {
    return new Response(arrayBuffer, {
      status: 200,
      headers: cachedResponse.headers,
    });
  }

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : arrayBuffer.byteLength - 1;
  const slicedBuffer = arrayBuffer.slice(start, end + 1);

  return new Response(slicedBuffer, {
    status: 206,
    statusText: "Partial Content",
    headers: new Headers({
      "Content-Type":
        cachedResponse.headers.get("Content-Type") ||
        "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
      "Content-Length": slicedBuffer.byteLength,
      "Accept-Ranges": "bytes",
    }),
  });
}
