// Register PMTiles Protocol
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("sw.js");
      console.log("Service Worker registered successfully.");
    } catch (err) {
      console.error("Service Worker registration failed:", err);
    }
  });
}

const balangodaCenter = { lat: 6.661, lng: 80.77 };
let map;
let fromMarker = null,
  toMarker = null;
let mapMode = null;
let fromCoords = null,
  toCoords = null;

function initMap(containerId = "map") {
  if (map) return;

  fetch("./style.json")
    .then((res) => res.json())
    .then((style) => {
      const pmtilesUrl = new URL("balangoda.pmtiles", window.location.href)
        .href;
      if (style.sources && style.sources["versatiles-shortbread"]) {
        style.sources["versatiles-shortbread"] = {
          type: "vector",
          url: "pmtiles://" + pmtilesUrl,
        };
      }

      map = new maplibregl.Map({
        container: containerId,
        style: style,
        center: [80.701561, 6.650622],
        zoom: 15,
        pitch: 65,
        bearing: -60,
        maxPitch: 85,
        hash: true,
      });

      map.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
        }),
        "bottom-right",
      );

      // 2. Add High-Accuracy Geolocate Location Control (GPS Icon)
      const geolocateControl = new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true, // Forces precise GPS location
          timeout: 6000,
        },
        trackUserLocation: true, // Continually tracks user position
        showUserHeading: true, // Shows device orientation arrow
        showAccuracyCircle: true,
      });
      map.addControl(geolocateControl, "bottom-right");

      map.addControl(
        new maplibregl.ScaleControl({
          maxWidth: 100,
          unit: "metric",
        }),
        "bottom-left",
      );
      // 3. Add Fullscreen Control
      map.addControl(new maplibregl.FullscreenControl(), "top-right");

      map.on("load", () => {
        // Source and layer for client-side Turf routing line
        map.addSource("offline-route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "offline-route-line",
          type: "line",
          source: "offline-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#007acc",
            "line-width": 5,
            "line-opacity": 0.85,
          },
        });
      });

      map.on("click", (e) => {
        const lngLat = [e.lngLat.lng, e.lngLat.lat];
        if (mapMode === "from") {
          fromCoords = lngLat;
          if (fromMarker) fromMarker.remove();
          fromMarker = new maplibregl.Marker({ color: "#3b82f6" })
            .setLngLat(lngLat)
            .addTo(map);
        } else if (mapMode === "to") {
          toCoords = lngLat;
          if (toMarker) toMarker.remove();
          toMarker = new maplibregl.Marker({ color: "#ef4444" })
            .setLngLat(lngLat)
            .addTo(map);
        }

        if (fromCoords && toCoords) {
          calculateOfflineRoute(fromCoords, toCoords);
        }
        setMapMode(null);
      });
    })
    .catch((err) => console.error("Error loading style.json:", err));
}

// Client-side offline distance & road calculations via Turf.js
function calculateOfflineRoute(start, end) {
  if (typeof turf === "undefined") {
    console.warn("Turf library not loaded.");
    return;
  }

  // Intersect features rendered from Shortbread map tiles
  const roadFeatures = map.queryRenderedFeatures({
    layers: ["streets", "highways", "roads"],
  });
  let selectedRoad = null;
  let minDistance = Infinity;

  if (roadFeatures.length > 0) {
    const startPoint = turf.point(start);
    roadFeatures.forEach((f) => {
      if (f.geometry.type === "LineString") {
        const d = turf.pointToLineDistance(startPoint, f);
        if (d < minDistance) {
          minDistance = d;
          selectedRoad = f;
        }
      }
    });
  }

  let routeGeometry;
  let distKm = 0;

  if (selectedRoad) {
    routeGeometry = selectedRoad.geometry;
    distKm = turf.length(selectedRoad, { units: "kilometers" });
  } else {
    // Geodesic fallback
    const line = turf.lineString([start, end]);
    routeGeometry = line.geometry;
    distKm = turf.length(line, { units: "kilometers" });
  }

  map.getSource("offline-route").setData({
    type: "Feature",
    geometry: routeGeometry,
  });

  const detailsEl = document.getElementById("resultDetails");
  if (detailsEl) {
    detailsEl.innerHTML += `<div><strong>Offline Road Dist:</strong> ${distKm.toFixed(2)} km</div>`;
  }
}

function setMapMode(mode) {
  mapMode = mode;
  document
    .getElementById("setFromBtn")
    ?.classList.toggle("active", mode === "from");
  document
    .getElementById("setToBtn")
    ?.classList.toggle("active", mode === "to");
}

function moveMapToFull() {
  const full = document.getElementById("map-full");
  if (!map || !full) return;
  if (map.getContainer().parentNode !== full) {
    full.appendChild(map.getContainer());
    setTimeout(() => map.resize(), 200);
  }
}

function showPage(pageId, navEl) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
  if (navEl) navEl.classList.add("active");

  if (pageId === "map-page" || pageId === "search-page") {
    moveMapToFull();
    setTimeout(() => map && map.resize(), 200);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap("map");
  document
    .getElementById("setFromBtn")
    ?.addEventListener("click", () => setMapMode("from"));
  document
    .getElementById("setToBtn")
    ?.addEventListener("click", () => setMapMode("to"));
});
