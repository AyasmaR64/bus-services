// --- Route & Bus Stop Setup ---
const routeCoordinates = [
  [80.701561, 6.650622], // Balangoda Central
  [80.705, 6.652],
  [80.71, 6.6545], // Temple Junction
  [80.716, 6.655],
  [80.722, 6.6525], // Green Valley Stop
  [80.728, 6.651],
  [80.733, 6.6535], // Clock Tower Square
  [80.736, 6.6548], // 1. Bedrock
  [80.738, 6.6555], // 2. Flintstones
  [80.74, 6.656], // Regional Terminal
];

const busHalts = [
  { name: "Balangoda Central Terminal", coords: [80.701561, 6.650622] },
  { name: "Temple Junction Stop", coords: [80.71, 6.6545] },
  { name: "Green Valley Stop", coords: [80.722, 6.6525] },
  { name: "Clock Tower Square", coords: [80.733, 6.6535] },
  { name: "bedrock", coords: [80.736, 6.6548] },
  { name: "Flintstones", coords: [80.738, 6.6555] },
  { name: "Regional Bus Terminal", coords: [80.74, 6.656] },
];

let isWaitingAtStop = false;
let waitTimer = 0;

// Simulation Variables
let animationDistance = 0;
let isAnimating = true;
let animFrameId = null;
const speedKmH = 120; // Speed of bus in simulation
const routeLine = turf.lineString(routeCoordinates);
const totalRouteLength = turf.length(routeLine, { units: "kilometers" });

let currentActiveStopIndex = -1;
let activePopup = new maplibregl.Popup({ closeButton: false, offset: 25 });
let simMap = null;

// --- Custom 3D Bus Layer with Three.js ---
function create3DBusLayer() {
  return {
    id: "3d-bus-layer",
    type: "custom",
    renderingMode: "3d",

    onAdd: function (map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(50, 100, 50);
      this.scene.add(dirLight);

      // Create 3D Procedural SLTB Leyland Bus Mesh
      const busGroup = new THREE.Group();

      // --- 1. Main Chassis & Body ---
      const bodyGeo = new THREE.BoxGeometry(9.6, 32, 12);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 }); // SLTB Red/Orange
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.z = 6.0;
      busGroup.add(body);

      // --- 2. Roof ---
      const roofGeo = new THREE.BoxGeometry(9.4, 31.6, 1.2);
      const roofMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // White Roof
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.z = 12.3;
      busGroup.add(roof);

      // --- 3. Windscreens & Windows ---
      const windowMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Dark tinted glass
      // Front Windscreen
      const frontWindscreen = new THREE.Mesh(
        new THREE.BoxGeometry(9.0, 0.2, 4.5),
        windowMat,
      );
      frontWindscreen.position.set(0, 16.0, 8.0);
      busGroup.add(frontWindscreen);
      // Rear Windscreen
      const rearWindscreen = new THREE.Mesh(
        new THREE.BoxGeometry(9.0, 0.2, 4.5),
        windowMat,
      );
      rearWindscreen.position.set(0, -16.0, 8.0);
      busGroup.add(rearWindscreen);
      // Side Windows (Left & Right strips)
      const sideWindowGeo = new THREE.BoxGeometry(0.2, 26, 4.0);
      const leftWindow = new THREE.Mesh(sideWindowGeo, windowMat);
      leftWindow.position.set(-4.8, 0, 8.0);
      const rightWindow = new THREE.Mesh(sideWindowGeo, windowMat);
      rightWindow.position.set(4.8, 0, 8.0);
      busGroup.add(leftWindow, rightWindow);

      // --- 4. Doors (Front & Rear Passenger Doors on left side) ---
      const doorMat = new THREE.MeshLambertMaterial({ color: 0xb91c1c });
      const frontDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 4.0, 7.5),
        doorMat,
      );
      frontDoor.position.set(-4.85, 10.0, 5.5);
      const rearDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 4.0, 7.5),
        doorMat,
      );
      rearDoor.position.set(-4.85, -6.0, 5.5);
      busGroup.add(frontDoor, rearDoor);

      // --- 5. Bumpers & Radiator Grill ---
      const chromeMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      // Front Bumper
      const frontBumper = new THREE.Mesh(
        new THREE.BoxGeometry(9.8, 0.8, 1.5),
        chromeMat,
      );
      frontBumper.position.set(0, 16.2, 2.0);
      // Rear Bumper
      const rearBumper = new THREE.Mesh(
        new THREE.BoxGeometry(9.8, 0.8, 1.5),
        chromeMat,
      );
      rearBumper.position.set(0, -16.2, 2.0);
      // Radiator Covering Shell / Grille
      const grillMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
      const radiatorGrill = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 0.3, 3.0),
        grillMat,
      );
      radiatorGrill.position.set(0, 16.1, 4.5);
      busGroup.add(frontBumper, rearBumper, radiatorGrill);

      // --- 6. Lights (Headlights, Signal Lights, Brake Lights) ---
      const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Yellowish white
      const signalMat = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Orange indicator
      const brakeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Red brake light

      // Headlights (Front)
      const leftHeadlight = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.3, 1.0),
        headLightMat,
      );
      leftHeadlight.position.set(-3.5, 16.1, 4.5);
      const rightHeadlight = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.3, 1.0),
        headLightMat,
      );
      rightHeadlight.position.set(3.5, 16.1, 4.5);
      // Signal Lights (Front corners)
      const leftSignal = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.3, 0.8),
        signalMat,
      );
      leftSignal.position.set(-4.5, 16.1, 4.5);
      const rightSignal = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.3, 0.8),
        signalMat,
      );
      rightSignal.position.set(4.5, 16.1, 4.5);
      // Brake Lights (Rear)
      const leftBrake = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.3, 1.0),
        brakeMat,
      );
      leftBrake.position.set(-3.5, -16.1, 4.5);
      const rightBrake = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.3, 1.0),
        brakeMat,
      );
      rightBrake.position.set(3.5, -16.1, 4.5);
      busGroup.add(
        leftHeadlight,
        rightHeadlight,
        leftSignal,
        rightSignal,
        leftBrake,
        rightBrake,
      );

      // --- 7. Tyres / Wheels ---
      const wheelGeo = new THREE.CylinderGeometry(1.8, 1.8, 1.2, 24);
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
      wheelGeo.rotateX(Math.PI / 2);

      const wPositions = [
        [-4.8, 10.5, 1.8], // Front Left
        [4.8, 10.5, 1.8], // Front Right
        [-4.8, -10.5, 1.8], // Rear Left
        [4.8, -10.5, 1.8], // Rear Right
      ];

      wPositions.push([-4.8, -13.5, 1.8], [4.8, -13.5, 1.8]); // Dual rear wheels for SLTB heavy bus

      wPositions.forEach((pos) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(...pos);
        busGroup.add(wheel);
      });

      this.busMesh = busGroup;
      this.scene.add(this.busMesh);
      this.map = map;

      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;
    },

    render: function (gl, matrix) {
      if (!this.busMesh) return;

      // Sample two points along the route to simulate true rigid-body wheelbase alignment
      const wheelbaseOffset = 0.015; // ~15 meters in coordinate span
      const rearDist = Math.max(0, animationDistance - wheelbaseOffset);
      const frontDist = Math.min(
        animationDistance + wheelbaseOffset,
        totalRouteLength,
      );

      const rearPt = turf.along(routeLine, rearDist, { units: "kilometers" });
      const frontPt = turf.along(routeLine, frontDist, { units: "kilometers" });
      const centerPt = turf.along(routeLine, animationDistance, {
        units: "kilometers",
      });

      const coords = centerPt.geometry.coordinates;

      // Calculate precise bearing from rear axle to front axle so bends feel natural
      const bearing = turf.bearing(rearPt, frontPt);

      const modelMercator = maplibregl.MercatorCoordinate.fromLngLat(coords, 0);
      const scale = modelMercator.meterInMercatorCoordinateUnits();

      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(modelMercator.x, modelMercator.y, modelMercator.z)
        .scale(new THREE.Vector3(scale, -scale, scale))
        .multiply(
          new THREE.Matrix4().makeRotationZ(((bearing + 180) * Math.PI) / 180),
        );

      this.camera.projectionMatrix = m.multiply(l);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.map.triggerRepaint();

      updateSimulatorProgress(coords, bearing);
    },
  };
}

// --- Map Initialization & Stop Layers ---
fetch("./style.json")
  .then((res) => res.json())
  .then((style) => {
    const pmtilesUrl = new URL("balangoda.pmtiles", window.location.href).href;
    if (style.sources && style.sources["versatiles-shortbread"]) {
      style.sources["versatiles-shortbread"] = {
        type: "vector",
        url: "pmtiles://" + pmtilesUrl,
      };
    }
    const bounds = [
      [80.38, 6.405],
      // SW
      [80.943, 6.776],
      // NE
    ];
    simMap = new maplibregl.Map({
      container: "sim-map",
      style: style,
      center: routeCoordinates[0],
      zoom: 16.5,
      pitch: 75, // Pitch for 3D perspective
      maxPitch: 85,
      //hash: true,
      maxBounds: bounds,
    });

    simMap.on("style.load", () => {
      // Add Route Source & Line Layer
      simMap.addSource("route", {
        type: "geojson",
        data: routeLine,
      });

      simMap.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#f8f377",
          "line-width": 12,
          "line-opacity": 0.8,
        },
      });

      simMap.addControl(new maplibregl.FullscreenControl(), "top-right");
      simMap.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
        }),
        "bottom-right",
      );
      // Add Bus Stops Source & Layer
      const stopsGeoJSON = {
        type: "FeatureCollection",
        features: busHalts.map((stop, idx) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: stop.coords },
          properties: { name: stop.name, index: idx },
        })),
      };

      simMap.addSource("bus-stops", { type: "geojson", data: stopsGeoJSON });

      // Outer Glowing Circle Layer for Stops
      simMap.addLayer({
        id: "bus-stops-glow",
        type: "circle",
        source: "bus-stops",
        paint: {
          "circle-radius": 10,
          "circle-color": "#ef4444",
          "circle-opacity": 0.3,
        },
      });

      // Core Circle Point Layer
      simMap.addLayer({
        id: "bus-stops-core",
        type: "circle",
        source: "bus-stops",
        paint: {
          "circle-radius": 6,
          "circle-color": "#dc2626",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Add 3D Bus Layer
      simMap.addLayer(create3DBusLayer());

      // Start Animation Loop
      startSimulation();
    });
  })
  .catch((err) => console.error("Error loading style for simulator map:", err));

// --- Animation Loop ---
let lastTimestamp = null;

function animate(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const deltaTime = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (isAnimating) {
    if (isWaitingAtStop) {
      waitTimer -= deltaTime;
      if (waitTimer <= 0) {
        isWaitingAtStop = false; // Resume driving after 30 seconds
      }
    } else {
      const distanceStep = (speedKmH / 3600) * deltaTime;
      animationDistance += distanceStep;

      if (animationDistance >= totalRouteLength) {
        animationDistance = 0;
      }

      // Check distance to active bus stops
      busHalts.forEach((stop, idx) => {
        const currentPt = turf.along(routeLine, animationDistance, {
          units: "kilometers",
        });
        const dist = turf.distance(currentPt, turf.point(stop.coords), {
          units: "kilometers",
        });
        if (dist < 0.03 && currentActiveStopIndex !== idx) {
          currentActiveStopIndex = idx;
          isWaitingAtStop = true;
          waitTimer = 30; // Pause for 30 seconds
        }
      });
    }

    if (simMap) {
      simMap.triggerRepaint();
    }
  }

  animFrameId = requestAnimationFrame(animate);
}

function startSimulation() {
  if (!animFrameId) {
    lastTimestamp = null;
    animFrameId = requestAnimationFrame(animate);
  }
}

// --- Update UI HUD & Passing Bus Stops ---
function updateSimulatorProgress(currentBusCoords, bearing) {
  const progressPct = Math.min(
    (animationDistance / totalRouteLength) * 100,
    100,
  );

  const progressBar = document.getElementById("routeProgressBar");
  const progressPctEl = document.getElementById("routeProgressPct");
  if (progressBar) progressBar.style.width = `${progressPct.toFixed(1)}%`;
  if (progressPctEl) progressPctEl.textContent = `${Math.round(progressPct)}%`;

  // Camera Follows Bus Position
  if (simMap) {
    simMap.easeTo({
      center: currentBusCoords,
      bearing: bearing,
      duration: 0,
      easing: (t) => t,
    });
  }

  // Check proximity to Bus Stops
  busHalts.forEach((stop, idx) => {
    const distanceToStop = turf.distance(
      turf.point(currentBusCoords),
      turf.point(stop.coords),
      { units: "kilometers" },
    );

    // If bus is within 100 meters (0.1 km) of a bus stop
    if (distanceToStop < 0.1) {
      if (currentActiveStopIndex !== idx) {
        currentActiveStopIndex = idx;

        // Display Popup over passing stop
        activePopup
          .setLngLat(stop.coords)
          .setHTML(`🚍 Passing: <strong>${stop.name}</strong>`)
          .addTo(simMap);

        const passingStopEl = document.getElementById("currentPassingStop");
        if (passingStopEl) passingStopEl.textContent = `Passing: ${stop.name}`;

        const nextStopNameEl = document.getElementById("nextStopName");
        if (nextStopNameEl) {
          const nextStop = busStops[idx + 1]
            ? busStops[idx + 1].name
            : "Route Completed";
          nextStopNameEl.textContent = nextStop;
        }
      }
    }
  });
}

// --- UI Controls ---
const toggleBtn = document.getElementById("toggleSimBtn");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    isAnimating = !isAnimating;
    toggleBtn.textContent = isAnimating
      ? "Pause Simulation"
      : "Resume Simulation";
    toggleBtn.className = isAnimating ? "btn btn-primary" : "btn btn-secondary";
    const busStatusEl = document.getElementById("busStatus");
    if (busStatusEl) {
      busStatusEl.textContent = isAnimating ? "On Route" : "Paused";
      busStatusEl.className = isAnimating
        ? "hud-value status-moving"
        : "hud-value";
    }
  });
}

const resetSimBtn = document.getElementById("resetSimBtn");
if (resetSimBtn) {
  resetSimBtn.addEventListener("click", () => {
    animationDistance = 0;
    currentActiveStopIndex = -1;
    if (activePopup) activePopup.remove();
    const passingStopEl = document.getElementById("currentPassingStop");
    if (passingStopEl)
      passingStopEl.textContent = `Passing: ${busStops[0].name}`;
    const nextStopNameEl = document.getElementById("nextStopName");
    if (nextStopNameEl) nextStopNameEl.textContent = busStops[1].name;
  });
}
