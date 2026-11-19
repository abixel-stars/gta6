// Solmar v2: a sun-soaked tropical coastal city with textured, curved
// surfaces instead of flat boxes — brick and plaster facades, glass towers,
// round trees and palms, a boardwalk with shops, boats in the marina,
// clouds, crosswalks and street furniture. Owns collision + road queries.
import * as THREE from 'three';
import { clamp, pick, rand, randInt } from './util.js';
import {
  makeRoadTexture,
  makeSidewalkTexture,
  makeBrickTexture,
  makePlasterTexture,
  makeRoofTexture,
  makeGlassTexture,
  makeWindowTexture,
  makeGrassTexture,
  makeSandTexture,
  makeWaterTexture,
  makeBoardwalkTexture,
  makeContainerTexture,
  makeSignTexture,
  makeAwningTexture,
  makeCrosswalkTexture,
  roundedRectShape,
} from './textures.js';

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

// Boardwalk shops the player can walk into (see interact.js).
export const SHOPS = [
  {
    id: 'market',
    name: 'Marea Market',
    x: -60,
    z: 201,
    sign: [{ text: 'MAREA MARKET', size: 56, color: '#ffd23e' }],
    items: [
      { name: 'Snack', price: 10, heal: 15 },
      { name: 'Soda', price: 5, heal: 5 },
      { name: 'Medkit', price: 40, heal: 40 },
    ],
  },
  {
    id: 'clinic',
    name: 'Clinica Sol',
    x: 0,
    z: 201,
    sign: [{ text: 'CLINICA SOL', size: 56, color: '#ffffff' }],
    items: [
      { name: 'Bandage', price: 25, heal: 25 },
      { name: 'Medkit', price: 40, heal: 40 },
      { name: 'Adrenaline', price: 60, heal: 100 },
    ],
  },
  {
    id: 'ammo',
    name: 'Solmar Ammo',
    x: 60,
    z: 201,
    sign: [{ text: 'SOLMAR AMMO', size: 56, color: '#ff8a5a' }],
    items: [
      { name: 'Ammo box +24', price: 30, ammo: 24 },
      { name: 'Ammo crate +48', price: 50, ammo: 48 },
      { name: 'Medkit', price: 40, heal: 40 },
    ],
  },
];

const SHOPFRONT_NAMES = [
  'TACOS EL SOL',
  'CAFÉ SOLMAR',
  'BAR LA PALMA',
  'FARMACIA',
  'PIZZA SOL',
  'LAUNDRY',
];

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];
    this.waterTexes = [];
    this.boats = [];
    this.clouds = [];
    this.roadTex = makeRoadTexture();
    this.sandTex = makeSandTexture();
    this.grassTex = makeGrassTexture();
    this.grassTex.repeat.set(48, 48);
    this.sidewalkTex = makeSidewalkTexture();
    this.brickTexes = [
      makeBrickTexture(0x9a5a44, '#c9b8a4'),
      makeBrickTexture(0x7a4a3a, '#b8a894'),
      makeBrickTexture(0xa86a4a, '#cbb89e'),
    ];
    this.plasterTexes = [
      makePlasterTexture('#e8d9b8'),
      makePlasterTexture('#d8b894'),
      makePlasterTexture('#e8c8a8'),
      makePlasterTexture('#c8d8c8'),
    ];
    this.roofTex = makeRoofTexture();
    this.glassTex = makeGlassTexture();
    this.glassTex.repeat.set(2, 2);
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
    this.buildSky();
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

  // Animate water, clouds and boats. Called every frame from the game loop.
  update(dt, time) {
    for (const t of this.waterTexes) {
      t.offset.x += dt * 0.008;
      t.offset.y += dt * 0.004;
    }
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 420) c.position.x = -420;
    }
    for (const b of this.boats) {
      b.position.y = 0.1 + Math.sin(time * 0.9 + b.userData.phase) * 0.18;
      b.rotation.z = Math.sin(time * 0.7 + b.userData.phase) * 0.02;
    }
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ map: this.grassTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // Ocean to the south, with an animated water texture.
    const waterTex = makeWaterTexture();
    waterTex.repeat.set(10, 3);
    this.waterTexes.push(waterTex);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 220),
      new THREE.MeshPhongMaterial({ map: waterTex, shininess: 90, specular: 0x99ccdd, transparent: true, opacity: 0.94 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.05, 330);
    this.scene.add(ocean);
    // Pale foam line where the sea meets the sand.
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.09, 221);
    this.scene.add(foam);
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
    // Textured sidewalk slabs for every block.
    for (let i = 0; i < ROAD_LINES.length - 1; i++) {
      for (let j = 0; j < ROAD_LINES.length - 1; j++) {
        const x0 = ROAD_LINES[i] + ROAD_WIDTH / 2;
        const x1 = ROAD_LINES[i + 1] - ROAD_WIDTH / 2;
        const z0 = ROAD_LINES[j] + ROAD_WIDTH / 2;
        const z1 = ROAD_LINES[j + 1] - ROAD_WIDTH / 2;
        const tex = this.sidewalkTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round((x1 - x0) / 8)), Math.max(1, Math.round((z1 - z0) / 8)));
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(x1 - x0, 0.24, z1 - z0),
          new THREE.MeshLambertMaterial({ map: tex })
        );
        slab.position.set((x0 + x1) / 2, 0.12, (z0 + z1) / 2);
        slab.receiveShadow = true;
        this.scene.add(slab);
      }
    }
    // Zebra crossings at the main intersections.
    const crossTex = makeCrosswalkTexture();
    for (const cx of [-66, 22, 110]) {
      for (const cz of [-66, 22, 110]) {
        const c1 = new THREE.Mesh(
          new THREE.PlaneGeometry(ROAD_WIDTH, 5),
          new THREE.MeshLambertMaterial({ map: crossTex })
        );
        c1.rotation.x = -Math.PI / 2;
        c1.position.set(cx, 0.09, cz + 8);
        this.scene.add(c1);
        const c2 = new THREE.Mesh(
          new THREE.PlaneGeometry(5, ROAD_WIDTH),
          new THREE.MeshLambertMaterial({ map: crossTex })
        );
        c2.rotation.x = -Math.PI / 2;
        c2.rotation.z = Math.PI / 2;
        c2.position.set(cx + 8, 0.09, cz);
        this.scene.add(c2);
      }
    }
    // Traffic lights at four busy intersections.
    for (const [lx, lz] of [[-66, -66], [-66, 66], [66, -66], [66, 66]]) {
      this.addTrafficLight(lx + 8, lz + 8);
    }
    // Fire hydrants dotted along sidewalks.
    const hydMat = new THREE.MeshLambertMaterial({ color: 0xc72e2e });
    for (const [hx, hz] of [[-30, -14], [30, 14], [-100, 58], [100, -58], [58, 100], [-58, -100]]) {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 10), hydMat);
      body.position.set(hx, 0.6, hz);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6), hydMat);
      cap.position.set(hx, 0.98, hz);
      this.scene.add(body, cap);
    }
  }

  addTrafficLight(x, z) {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3136 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.4, 8), poleMat);
    pole.position.set(x, 2.7, z);
    this.scene.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x - 1.5, 5.3, z);
    this.scene.add(arm);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.2, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1d20 })
    );
    box.position.set(x - 3, 4.9, z);
    this.scene.add(box);
    const lightCols = [0xff2a2a, 0xe8c832, 0x3ac96b];
    lightCols.forEach((col, i) => {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: col })
      );
      lamp.position.set(x - 3, 5.25 - i * 0.35, z + 0.26);
      this.scene.add(lamp);
    });
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

  // One building: textured facade, tiled roof slab, rooftop props, and
  // sometimes a shopfront awning + sign on the street side.
  addBuilding(bx, bz, w, d, h, district) {
    const rng = this.rng;
    // A few downtown lots become round glass towers instead of boxes.
    if (district === 'downtown' && rng() < 0.35) {
      const r = Math.min(w, d) / 2 - 1;
      const tex = this.glassTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(3, Math.max(1, Math.round(h / 24)));
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r + 0.6, h, 24),
        new THREE.MeshLambertMaterial({ map: tex })
      );
      tower.position.set(bx, h / 2 + 0.24, bz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.scene.add(tower);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(r + 0.3, r + 0.3, 0.7, 24),
        new THREE.MeshLambertMaterial({ map: this.roofTex })
      );
      cap.position.set(bx, h + 0.55, bz);
      this.scene.add(cap);
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 2.2, 12),
        new THREE.MeshLambertMaterial({ color: 0x8a7f72 })
      );
      tank.position.set(bx + r * 0.4, h + 1.8, bz);
      this.scene.add(tank);
      this.addCollider(bx - r, bz - r, bx + r, bz + r);
      return;
    }
    let tex;
    if (district === 'oldtown') tex = pick(rng, this.brickTexes);
    else if (district === 'residential') tex = pick(rng, this.plasterTexes);
    else tex = pick(rng, this.windowTexes);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(bx, h / 2 + 0.24, bz);
    b.castShadow = true;
    b.receiveShadow = true;
    this.scene.add(b);
    // Tiled roof slab + parapet rim.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshLambertMaterial({ map: this.roofTex })
    );
    roof.position.set(bx, h + 0.45, bz);
    this.scene.add(roof);
    // Rooftop props: AC box and sometimes a round water tank.
    if (rng() < 0.55) {
      const ac = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.9, 1.6),
        new THREE.MeshLambertMaterial({ color: 0x9aa0a4 })
      );
      ac.position.set(bx + rand(rng, -w / 4, w / 4), h + 1.1, bz + rand(rng, -d / 4, d / 4));
      this.scene.add(ac);
    }
    if (rng() < 0.25) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 1.8, 12),
        new THREE.MeshLambertMaterial({ color: 0x7a6a58 })
      );
      tank.position.set(bx - w / 4, h + 1.5, bz - d / 4);
      this.scene.add(tank);
    }
    // Ground-floor shopfront facing the nearest street.
    if ((district === 'midtown' || district === 'downtown') && rng() < 0.3 && h < 24) {
      this.addShopfront(bx, bz, w, d);
    }
    this.addCollider(bx - w / 2, bz - d / 2, bx + w / 2, bz + d / 2);
  }

  addShopfront(bx, bz, w, d) {
    const rng = this.rng;
    const name = pick(rng, SHOPFRONT_NAMES);
    const signTex = makeSignTexture([{ text: name, size: 44, color: '#ffd23e' }], '#20262b', '#ffd23e');
    const near = this.nearestRoad(bx, bz);
    // Face the sign toward the nearest road.
    let sx = bx;
    let sz = bz;
    let ry = 0;
    if (near.axis === 'z') {
      const dir = bx < near.line ? -1 : 1;
      sx = bx + dir * (w / 2 + 0.15);
      ry = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const dir = bz < near.line ? -1 : 1;
      sz = bz + dir * (d / 2 + 0.15);
      ry = dir > 0 ? 0 : Math.PI;
    }
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.5),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    sign.position.set(sx, 3.4, sz);
    sign.rotation.y = ry;
    this.scene.add(sign);
    // Striped awning above the door, tilted out over the sidewalk.
    const awnTex = makeAwningTexture('#c72e2e', '#f2ead8');
    const awn = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 1.6),
      new THREE.MeshLambertMaterial({ map: awnTex, side: THREE.DoubleSide })
    );
    awn.position.set(sx, 2.6, sz);
    awn.rotation.y = ry;
    awn.rotateX(-0.5);
    awn.translateZ(0.7);
    this.scene.add(awn);
  }

  buildBlocks() {
    const rng = this.rng;
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
          this.addBuilding(bx, bz, w, d, h, district);
        }
      }
    }
    // Grand Solmar Hotel: a round glass tower, the city landmark.
    const hotelTex = this.glassTex.clone();
    hotelTex.needsUpdate = true;
    hotelTex.repeat.set(4, 3);
    const hotel = new THREE.Mesh(
      new THREE.CylinderGeometry(13, 14, 78, 28),
      new THREE.MeshLambertMaterial({ map: hotelTex })
    );
    hotel.position.set(LANDMARKS.hotel.x, 39.24, LANDMARKS.hotel.z);
    hotel.castShadow = true;
    this.scene.add(hotel);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(13, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xd8a03c })
    );
    dome.position.set(LANDMARKS.hotel.x, 78.24, LANDMARKS.hotel.z);
    this.scene.add(dome);
    const hotelSign = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({
        map: makeSignTexture([{ text: 'GRAND SOLMAR', size: 52, color: '#ffd23e' }], '#20262b', '#ffd23e'),
      })
    );
    hotelSign.position.set(LANDMARKS.hotel.x, 62, LANDMARKS.hotel.z + 14.2);
    this.scene.add(hotelSign);
    this.addCollider(32, -100, 56, -76);
  }

  buildPark(cx, cz) {
    const rng = this.rng;
    const grassTex = this.grassTex.clone();
    grassTex.needsUpdate = true;
    grassTex.repeat.set(3, 3);
    const grass = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.5, 30),
      new THREE.MeshLambertMaterial({ map: grassTex })
    );
    grass.position.set(cx, 0.25, cz);
    grass.receiveShadow = true;
    this.scene.add(grass);
    // Circular plaza with a fountain at the park's heart.
    const plazaTex = this.sidewalkTex.clone();
    plazaTex.needsUpdate = true;
    plazaTex.repeat.set(4, 4);
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(11, 28),
      new THREE.MeshLambertMaterial({ map: plazaTex })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(cx, 0.52, cz);
    this.scene.add(plaza);
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4.4, 0.9, 24),
      new THREE.MeshLambertMaterial({ color: 0xb8b0a4 })
    );
    basin.position.set(cx, 0.9, cz);
    this.scene.add(basin);
    const pondTex = makeWaterTexture();
    pondTex.repeat.set(2, 2);
    this.waterTexes.push(pondTex);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(3.7, 24),
      new THREE.MeshPhongMaterial({ map: pondTex, shininess: 80 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 1.32, cz);
    this.scene.add(water);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 2.2, 12),
      new THREE.MeshLambertMaterial({ color: 0x9a9484 })
    );
    column.position.set(cx, 2.2, cz);
    this.scene.add(column);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 14, 10),
      new THREE.MeshLambertMaterial({ color: 0xd8c9a8 })
    );
    orb.position.set(cx, 3.6, cz);
    this.scene.add(orb);
    // Round-canopy trees and a pond off to the side.
    for (let i = 0; i < 9; i++) {
      const tx = cx + rand(rng, -13, 13);
      const tz = cz + rand(rng, -13, 13);
      if (Math.hypot(tx - cx, tz - cz) < 12) continue;
      this.addTree(tx, tz, rand(rng, 0.8, 1.3));
    }
    const pond2Tex = makeWaterTexture();
    pond2Tex.repeat.set(2, 2);
    this.waterTexes.push(pond2Tex);
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(5, 20),
      new THREE.MeshPhongMaterial({ map: pond2Tex, shininess: 80 })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(cx + 6, 0.55, cz + 6);
    this.scene.add(pond);
    // Benches facing the fountain.
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    for (const [bx, bz, ry] of [[-8, 0, 0], [8, 0, Math.PI], [0, -8, Math.PI / 2], [0, 8, -Math.PI / 2]]) {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.7), benchMat);
      seat.position.y = 0.55;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.15), benchMat);
      back.position.set(0, 0.95, -0.3);
      bench.add(seat, back);
      bench.position.set(cx + bx, 0.55, cz + bz);
      bench.rotation.y = ry;
      this.scene.add(bench);
    }
  }

  addTree(x, z, s) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.4 * s, 8),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
    );
    trunk.position.set(x, 1.2 * s + 0.24, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    // Round canopy: a cluster of spheres instead of a cone.
    const greens = [0x3f8f3a, 0x4da344, 0x35802f];
    const canopy = new THREE.Group();
    for (const [ox, oy, oz, r] of [[0, 3.4, 0, 1.9], [1.1, 2.9, 0.4, 1.2], [-1, 3.0, -0.5, 1.2], [0.2, 4.1, -0.3, 1.1]]) {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(r * s, 12, 9),
        new THREE.MeshLambertMaterial({ color: pick(this.rng, greens) })
      );
      ball.position.set(ox * s, oy * s, oz * s);
      ball.castShadow = true;
      canopy.add(ball);
    }
    canopy.position.set(x, 0.24, z);
    this.scene.add(canopy);
    this.addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  }

  addPalm(x, z, s) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 5 * s, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 })
    );
    trunk.position.set(x, 2.5 * s, z);
    trunk.rotation.z = 0.12;
    trunk.castShadow = true;
    this.scene.add(trunk);
    // Round crown: a flattened sphere with drooping fronds.
    const crownBall = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 * s, 12, 8),
      new THREE.MeshLambertMaterial({ color: 0x2f9e4f })
    );
    crownBall.scale.y = 0.55;
    crownBall.position.set(x + 0.5 * s, 5.2 * s, z);
    this.scene.add(crownBall);
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
    const sandTex = this.sandTex.clone();
    sandTex.needsUpdate = true;
    sandTex.repeat.set(12, 2);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 44),
      new THREE.MeshLambertMaterial({ map: sandTex })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.08, 242);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // Gentle dunes along the back of the beach.
    for (let i = 0; i < 6; i++) {
      const dune = new THREE.Mesh(
        new THREE.SphereGeometry(rand(rng, 6, 10), 12, 8),
        new THREE.MeshLambertMaterial({ map: sandTex })
      );
      dune.scale.y = 0.22;
      dune.position.set(-190 + i * 76 + rand(rng, -10, 10), 0.1, 218 + rand(rng, -2, 4));
      this.scene.add(dune);
    }
    // Beach palms and umbrellas.
    for (let i = 0; i < 14; i++) {
      this.addPalm(-200 + i * 30 + rand(rng, -6, 6), 228 + rand(rng, -4, 10), rand(rng, 0.8, 1.2));
    }
    const umbrellaCols = [0xe84a5a, 0x2a9ad8, 0xe8c832, 0x53a05a];
    for (let i = 0; i < 8; i++) {
      const ux = -175 + i * 50 + rand(rng, -8, 8);
      const uz = 234 + rand(rng, -3, 3);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6),
        new THREE.MeshLambertMaterial({ color: 0xd8d3c8 })
      );
      pole.position.set(ux, 1.2, uz);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 0.9, 10),
        new THREE.MeshLambertMaterial({ color: pick(rng, umbrellaCols) })
      );
      top.position.set(ux, 2.7, uz);
      this.scene.add(pole, top);
    }
    // Boardwalk with three shops.
    const boardTex = makeBoardwalkTexture();
    boardTex.repeat.set(20, 1);
    const boardwalk = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 14),
      new THREE.MeshLambertMaterial({ map: boardTex })
    );
    boardwalk.rotation.x = -Math.PI / 2;
    boardwalk.position.set(0, 0.1, 207);
    boardwalk.receiveShadow = true;
    this.scene.add(boardwalk);
    for (const shop of SHOPS) {
      this.buildShopKiosk(shop);
    }
    // Marina piers.
    const pierTex = makeBoardwalkTexture();
    const pierMat = new THREE.MeshLambertMaterial({ map: pierTex });
    for (const px of [-120, -44, 44]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 26), pierMat);
      pier.position.set(px, 0.4, 252);
      pier.castShadow = true;
      this.scene.add(pier);
      this.addCollider(px - 4, 240, px + 4, 264);
      for (const pz of [242, 262]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8),
          new THREE.MeshLambertMaterial({ color: 0x5a4630 })
        );
        post.position.set(px - 3.6, 0.9, pz);
        this.scene.add(post);
        const post2 = post.clone();
        post2.position.x = px + 3.6;
        this.scene.add(post2);
      }
      this.buildBoat(px + 12, 258);
    }
    this.buildBoat(-70, 266);
    this.buildBoat(80, 264);
    // Harbor containers and cranes on the east edge.
    const contColors = [0xc75b4a, 0x4a7fc7, 0x53a05a, 0xd8a03c];
    for (let i = 0; i < 10; i++) {
      const col = pick(rng, contColors);
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(8, 3, 3),
        new THREE.MeshLambertMaterial({ map: makeContainerTexture(col) })
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
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 26, 8), craneMat);
      leg1.position.set(228, 13, cz);
      const leg2 = leg1.clone();
      leg2.position.set(238, 13, cz);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 18, 8), craneMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set(233, 26, cz);
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0x2e3136 })
      );
      cable.position.set(226, 22, cz);
      const hook = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.2, 1.2),
        new THREE.MeshLambertMaterial({ color: 0x2e3136 })
      );
      hook.position.set(226, 17.5, cz);
      this.scene.add(leg1, leg2, beam, cable, hook);
    }
  }

  // One boardwalk shop: rounded kiosk, striped awning, painted sign and a
  // counter in front. Front faces the city (-z).
  buildShopKiosk(shop) {
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(10, 7, 1.2), {
      depth: 4.6,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
      bevelSegments: 2,
    });
    geo.rotateX(-Math.PI / 2);
    const kiosk = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color: 0xe8d9b8 })
    );
    kiosk.position.set(shop.x, 0.24, shop.z);
    kiosk.castShadow = true;
    this.scene.add(kiosk);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.5, 8),
      new THREE.MeshLambertMaterial({ map: this.roofTex })
    );
    roof.position.set(shop.x, 5.4, shop.z);
    this.scene.add(roof);
    // Sign above the door, facing the city.
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({
        map: makeSignTexture(shop.sign, '#20262b', '#ffd23e'),
      })
    );
    sign.position.set(shop.x, 4.4, shop.z - 3.7);
    sign.rotation.y = Math.PI;
    this.scene.add(sign);
    // Striped awning over the counter.
    const awn = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshLambertMaterial({
        map: makeAwningTexture('#c72e2e', '#f2ead8'),
        side: THREE.DoubleSide,
      })
    );
    awn.position.set(shop.x, 3.1, shop.z - 4.2);
    awn.rotation.x = -0.45;
    this.scene.add(awn);
    // Counter + goods in front of the kiosk.
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(7, 1, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2a })
    );
    counter.position.set(shop.x, 0.7, shop.z - 4.6);
    counter.castShadow = true;
    this.scene.add(counter);
    for (let i = 0; i < 3; i++) {
      const goods = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.7, 0.8),
        new THREE.MeshLambertMaterial({ color: pick(this.rng, [0xe84a5a, 0x53a05a, 0xe8c832]) })
      );
      goods.position.set(shop.x - 2.2 + i * 2.2, 1.55, shop.z - 4.6);
      this.scene.add(goods);
    }
    this.addCollider(shop.x - 5, shop.z - 3.5, shop.x + 5, shop.z + 3.5);
  }

  // A small motorboat: extruded lens hull, rounded cabin, mast and sail.
  buildBoat(x, z) {
    const group = new THREE.Group();
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, -4);
    hullShape.quadraticCurveTo(1.6, -2, 1.6, 0);
    hullShape.quadraticCurveTo(1.6, 3, 0, 4.4);
    hullShape.quadraticCurveTo(-1.6, 3, -1.6, 0);
    hullShape.quadraticCurveTo(-1.6, -2, 0, -4);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 1.1,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.25,
      bevelSegments: 1,
    });
    hullGeo.rotateX(-Math.PI / 2);
    const hull = new THREE.Mesh(
      hullGeo,
      new THREE.MeshLambertMaterial({ color: 0xf2ead8 })
    );
    hull.castShadow = true;
    group.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x2a7a8a })
    );
    cabin.position.set(0, 1.5, -0.4);
    group.add(cabin);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 })
    );
    mast.position.set(0, 3.4, 0.6);
    group.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 3.4);
    sailShape.lineTo(2.2, 0.2);
    sailShape.closePath();
    const sail = new THREE.Mesh(
      new THREE.ShapeGeometry(sailShape),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    sail.position.set(0.1, 1.6, 0.6);
    group.add(sail);
    group.position.set(x, 0.1, z);
    group.rotation.y = rand(this.rng, -0.4, 0.4);
    group.userData.phase = this.rng() * 6;
    this.scene.add(group);
    this.boats.push(group);
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

  // Warm dusk sky: drifting clouds of round puffs over the city.
  buildSky() {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 9; i++) {
      const cluster = new THREE.Group();
      const puffs = 3 + randInt(this.rng, 0, 2);
      for (let j = 0; j < puffs; j++) {
        const r = rand(this.rng, 6, 12);
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), cloudMat);
        puff.scale.y = 0.45;
        puff.position.set(j * rand(this.rng, 7, 11) - puffs * 4, rand(this.rng, -1, 1), rand(this.rng, -4, 4));
        cluster.add(puff);
      }
      cluster.position.set(rand(this.rng, -350, 350), rand(this.rng, 95, 140), rand(this.rng, -300, 250));
      cluster.userData.drift = rand(this.rng, 0.6, 1.6);
      this.scene.add(cluster);
      this.clouds.push(cluster);
    }
  }
}
