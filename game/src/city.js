// Solmar: a sun-soaked tropical coastal city. Builds the ground, roads,
// buildings, beach, harbor and props, and owns collision + road queries.
import * as THREE from 'three';
import { clamp, pick, rand, randInt } from './util.js';

export const CITY_HALF = 220;
export const ROAD_LINES = [-198, -154, -110, -66, -22, 22, 66, 110, 154, 198];
export const ROAD_WIDTH = 12;

// Named places the missions use.
export const LANDMARKS = {
  depot: { x: -176, z: -44, name: 'Solmar Express Depot' },
  marina: { x: -44, z: 176, name: 'Marina Bay' },
  hotel: { x: 44, z: -88, name: 'Grand Solmar Hotel' },
  garage: { x: 176, z: 44, name: "Ray's Garage" },
  harbor: { x: 198, z: -176, name: 'Solmar Harbor' },
  warehouse: { x: -176, z: 88, name: 'Old Town Warehouse' },
  safehouse: { x: 154, z: 88, name: 'Las Palmas Safehouse' },
  penthouse: { x: 44, z: -132, name: 'Solmar Grand Penthouse' },
  park: { x: 0, z: 0, name: 'Central Park' },
  beach: { x: 0, z: 210, name: 'Solmar Beach' },
};

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2b2e33';
  for (let i = 0; i < 200; i++) {
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  // Edge lines run along the road: horizontal in canvas space (constant V).
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 5, 128, 3);
  g.fillRect(0, 120, 128, 3);
  // Center dashes: horizontal at the middle, dashed along the road (U).
  g.fillStyle = '#e8d44d';
  g.fillRect(0, 62, 44, 4);
  g.fillRect(84, 62, 44, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWindowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 28) {
    for (let x = 10; x < 118; x += 26) {
      const on = Math.random() < 0.42;
      g.fillStyle = on ? lit : '#1d2733';
      g.fillRect(x, y, 16, 18);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSandTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e8d3a0';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#dcc389';
  for (let i = 0; i < 260; i++) {
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];
    this.roadTex = makeRoadTexture();
    this.sandTex = makeSandTexture();
    this.windowTexes = [
      makeWindowTexture('#c98f5f', '#ffe9a8'),
      makeWindowTexture('#7f9fb8', '#cfe8ff'),
      makeWindowTexture('#b8b0a4', '#fff2c8'),
      makeWindowTexture('#8a7f8d', '#ffd9a0'),
    ];
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeachAndHarbor();
    this.buildPalmsAndLamps();
  }

  addCollider(x0, z0, x1, z1) {
    this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  // Push a circle (player or car) out of every building collider it overlaps.
  collideCircle(p, r) {
    for (const c of this.colliders) {
      const nx = clamp(p.x, c.x0, c.x1);
      const nz = clamp(p.z, c.z0, c.z1);
      const dx = p.x - nx;
      const dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * r;
          p.z = nz + (dz / d) * r;
        } else {
          p.x = c.x1 + r;
        }
      }
    }
  }

  pointBlocked(x, z, r) {
    for (const c of this.colliders) {
      const nx = clamp(x, c.x0, c.x1);
      const nz = clamp(z, c.z0, c.z1);
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  nearestRoad(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const v of ROAD_LINES) {
      const d = Math.abs(x - v);
      if (d < bestD) {
        bestD = d;
        best = { axis: 'z', line: v, dist: d };
      }
      const d2 = Math.abs(z - v);
      if (d2 < bestD) {
        bestD = d2;
        best = { axis: 'x', line: v, dist: d2 };
      }
    }
    return best;
  }

  onRoad(x, z) {
    return this.nearestRoad(x, z).dist < ROAD_WIDTH / 2 + 1;
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: 0x9aa08a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // Ocean to the south.
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 220),
      new THREE.MeshLambertMaterial({ color: 0x2e7fa8, transparent: true, opacity: 0.92 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.05, 330);
    this.scene.add(ocean);
  }

  buildRoads() {
    const span = CITY_HALF * 2 + 40;
    for (const v of ROAD_LINES) {
      // Road along X: texture U runs along the road.
      const texH = this.roadTex.clone();
      texH.needsUpdate = true;
      texH.repeat.set(span / 24, 1);
      const stripH = new THREE.Mesh(
        new THREE.PlaneGeometry(span, ROAD_WIDTH),
        new THREE.MeshLambertMaterial({ map: texH })
      );
      stripH.rotation.x = -Math.PI / 2;
      stripH.position.set(0, 0.06, v);
      stripH.receiveShadow = true;
      this.scene.add(stripH);
      // Road along Z: plane turned so its height runs north, texture rotated
      // so its U still runs along the road.
      const texV = this.roadTex.clone();
      texV.needsUpdate = true;
      texV.center.set(0.5, 0.5);
      texV.rotation = Math.PI / 2;
      texV.repeat.set(span / 24, 1);
      const stripV = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_WIDTH, span),
        new THREE.MeshLambertMaterial({ map: texV })
      );
      stripV.rotation.x = -Math.PI / 2;
      stripV.position.set(v, 0.06, 0);
      stripV.receiveShadow = true;
      this.scene.add(stripV);
    }
    // Sidewalk slabs for every block.
    const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
    for (let i = 0; i < ROAD_LINES.length - 1; i++) {
      for (let j = 0; j < ROAD_LINES.length - 1; j++) {
        const x0 = ROAD_LINES[i] + ROAD_WIDTH / 2;
        const x1 = ROAD_LINES[i + 1] - ROAD_WIDTH / 2;
        const z0 = ROAD_LINES[j] + ROAD_WIDTH / 2;
        const z1 = ROAD_LINES[j + 1] - ROAD_WIDTH / 2;
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(x1 - x0, 0.24, z1 - z0),
          walkMat
        );
        slab.position.set((x0 + x1) / 2, 0.12, (z0 + z1) / 2);
        slab.receiveShadow = true;
        this.scene.add(slab);
      }
    }
  }

  districtAt(x, z) {
    if (z > 150) return 'beach';
    if (x > 190) return 'harbor';
    if (Math.abs(x) < 44 && Math.abs(z) < 44) return 'park';
    if (z < -22 && Math.abs(x) < 110) return 'downtown';
    if (x < -66) return 'oldtown';
    if (x > 66) return 'residential';
    return 'midtown';
  }

  buildBlocks() {
    const rng = this.rng;
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x5d6a72 });
    for (let i = 0; i < ROAD_LINES.length - 1; i++) {
      for (let j = 0; j < ROAD_LINES.length - 1; j++) {
        const x0 = ROAD_LINES[i] + ROAD_WIDTH / 2 + 2;
        const x1 = ROAD_LINES[i + 1] - ROAD_WIDTH / 2 - 2;
        const z0 = ROAD_LINES[j] + ROAD_WIDTH / 2 + 2;
        const z1 = ROAD_LINES[j + 1] - ROAD_WIDTH / 2 - 2;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const district = this.districtAt(cx, cz);
        if (district === 'park') {
          this.buildPark(cx, cz);
          continue;
        }
        if (district === 'beach') continue;
        if (district === 'harbor') continue;
        const lots = district === 'downtown' ? 1 : 2;
        for (let l = 0; l < lots; l++) {
          const w = (x1 - x0) / lots - 3;
          const d = z1 - z0 - 4;
          const bx = x0 + (w + 3) * l + w / 2 + 1.5;
          const bz = cz + rand(rng, -2, 2);
          let h;
          if (district === 'downtown') h = rand(rng, 26, 64);
          else if (district === 'oldtown') h = rand(rng, 10, 20);
          else if (district === 'residential') h = rand(rng, 6, 12);
          else h = rand(rng, 12, 30);
          const tex = pick(rng, this.windowTexes);
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(bx, h / 2 + 0.24, bz);
          b.castShadow = true;
          b.receiveShadow = true;
          this.scene.add(b);
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), roofMat);
          roof.position.set(bx, h + 0.5, bz);
          this.scene.add(roof);
          this.addCollider(bx - w / 2, bz - d / 2, bx + w / 2, bz + d / 2);
        }
      }
    }
    // Grand Solmar Hotel tower, the city landmark.
    const hotel = new THREE.Mesh(
      new THREE.BoxGeometry(24, 78, 24),
      new THREE.MeshLambertMaterial({ map: this.windowTexes[1] })
    );
    hotel.position.set(LANDMARKS.hotel.x, 39.24, LANDMARKS.hotel.z);
    hotel.castShadow = true;
    this.scene.add(hotel);
    this.addCollider(32, -100, 56, -76);
  }

  buildPark(cx, cz) {
    const rng = this.rng;
    const grass = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.5, 30),
      new THREE.MeshLambertMaterial({ color: 0x5da24a })
    );
    grass.position.set(cx, 0.25, cz);
    grass.receiveShadow = true;
    this.scene.add(grass);
    for (let i = 0; i < 9; i++) {
      const tx = cx + rand(rng, -13, 13);
      const tz = cz + rand(rng, -13, 13);
      this.addTree(tx, tz, rand(rng, 0.8, 1.3));
    }
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(5, 20),
      new THREE.MeshLambertMaterial({ color: 0x3f8fb5 })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(cx + 6, 0.55, cz + 6);
    this.scene.add(pond);
  }

  addTree(x, z, s) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.4 * s, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
    );
    trunk.position.set(x, 1.2 * s + 0.24, z);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.8 * s, 3.2 * s, 8),
      new THREE.MeshLambertMaterial({ color: 0x3f8f3a })
    );
    crown.position.set(x, 3.6 * s, z);
    crown.castShadow = true;
    this.scene.add(trunk, crown);
    this.addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  }

  addPalm(x, z, s) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 5 * s, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 })
    );
    trunk.position.set(x, 2.5 * s, z);
    trunk.rotation.z = 0.12;
    trunk.castShadow = true;
    this.scene.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 3.4 * s, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.4 * s, 5.1 * s, z + Math.sin(a) * 1.4 * s);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      this.scene.add(leaf);
    }
  }

  buildBeachAndHarbor() {
    const rng = this.rng;
    // Sand strip along the south edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 44),
      new THREE.MeshLambertMaterial({ map: this.sandTex })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.08, 242);
    sand.receiveShadow = true;
    this.scene.add(sand);
    for (let i = 0; i < 14; i++) {
      this.addPalm(-200 + i * 30 + rand(rng, -6, 6), 228 + rand(rng, -4, 10), rand(rng, 0.8, 1.2));
    }
    // Marina piers.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    for (const px of [-120, -44, 44]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 26), pierMat);
      pier.position.set(px, 0.4, 252);
      pier.castShadow = true;
      this.scene.add(pier);
      this.addCollider(px - 4, 240, px + 4, 264);
    }
    // Harbor containers and cranes on the east edge.
    const contColors = [0xc75b4a, 0x4a7fc7, 0x53a05a, 0xd8a03c];
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(8, 3, 3),
        new THREE.MeshLambertMaterial({ color: pick(rng, contColors) })
      );
      const cx = 232 + rand(rng, -6, 10);
      const cz = -190 + i * 18 + rand(rng, -3, 3);
      c.position.set(cx, 1.7, cz);
      c.rotation.y = rand(rng, -0.1, 0.1);
      c.castShadow = true;
      this.scene.add(c);
      this.addCollider(cx - 4, cz - 2, cx + 4, cz + 2);
    }
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a03c });
    for (const cz of [-140, -60]) {
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 26, 1.5), craneMat);
      leg1.position.set(228, 13, cz);
      const leg2 = leg1.clone();
      leg2.position.set(238, 13, cz);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 1.5, 1.5), craneMat);
      beam.position.set(233, 26, cz);
      this.scene.add(leg1, leg2, beam);
    }
  }

  buildPalmsAndLamps() {
    const rng = this.rng;
    // Street lamps along the main avenue.
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x2e3136 });
    for (const v of ROAD_LINES) {
      for (const u of [-154, -66, 22, 110, 198]) {
        if (Math.abs(v) > 200 || Math.abs(u) > 200) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
        pole.position.set(v + 7, 3, u + 7);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
        );
        bulb.position.set(v + 7, 6.1, u + 7);
        this.scene.add(bulb);
      }
    }
    // Extra palms along the beach road.
    for (let i = 0; i < 8; i++) {
      this.addPalm(-180 + i * 48 + rand(rng, -5, 5), 196, rand(rng, 0.9, 1.2));
    }
  }
}
