// Cars of Solmar v2: building them, driving them, and the traffic that fills
// the streets. Every car is an original curved build: an extruded side
// profile with a rounded nose and tail, a sloped glass cabin, torus tires
// with hubcaps, bumpers, mirrors and lights — no more plain boxes.
import * as THREE from 'three';
import { angleDiff, angleLerp, clamp, pick, rand } from './util.js';

export const CAR_TYPES = {
  sedan: { name: 'Solmar Sedan', color: 0x8a9bb0, speed: 26, accel: 14 },
  taxi: { name: 'Solmar Taxi', color: 0xe8c832, speed: 24, accel: 13 },
  pickup: { name: 'Cactus Pickup', color: 0x7a5a3a, speed: 24, accel: 12 },
  sports: { name: 'Cometa GT', color: 0xc72e2e, speed: 38, accel: 22 },
  van: { name: 'Solmar Van', color: 0xd8d3c8, speed: 21, accel: 10 },
  cruiser: { name: 'Solmar Police Cruiser', color: 0x2a2f38, speed: 34, accel: 20 },
};

const PAINTS = [0x8a9bb0, 0xc72e2e, 0x3f7a4a, 0xd8a03c, 0x6a5a8a, 0xd8d3c8, 0x4a7fc7];

// Extrude a side-profile shape across the car's width, so the body has a
// rounded nose, a sloped hood and soft bevelled edges instead of box corners.
// The profile is drawn with +x as the nose; the geometry is turned so the
// length runs along +z (the car's forward) and centered on the axle line.
function extrudeProfile(shape, width, bevel) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return geo;
}

function sedanBodyShape(len, top) {
  const h = len / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + 0.1, 0.12);
  s.lineTo(h - 0.25, 0.12);
  s.quadraticCurveTo(h, 0.12, h, 0.38); // rounded nose
  s.lineTo(h - 0.04, 0.62);
  s.quadraticCurveTo(h - 0.07, top, h - 0.35, top); // hood edge
  s.lineTo(-h + 0.45, top); // beltline
  s.quadraticCurveTo(-h, top, -h, 0.55); // rounded tail
  s.lineTo(-h, 0.35);
  s.quadraticCurveTo(-h, 0.12, -h + 0.25, 0.12); // rounded tail bottom
  s.closePath();
  return s;
}

function cabinShape(x0, x1, base, roof) {
  const s = new THREE.Shape();
  s.moveTo(x0, base);
  s.lineTo(x1, base);
  s.quadraticCurveTo(x1 - 0.14, base + 0.24, x1 - 0.55, roof - 0.04); // windshield
  s.lineTo(x0 + 0.5, roof); // roof
  s.quadraticCurveTo(x0 + 0.1, roof - 0.02, x0, base + 0.17); // rear slope
  s.closePath();
  return s;
}

function vanBodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.2, 0.12);
  s.lineTo(1.9, 0.12);
  s.quadraticCurveTo(2.2, 0.12, 2.2, 0.4);
  s.lineTo(2.12, 0.72);
  s.quadraticCurveTo(2.05, 0.95, 1.75, 0.98);
  s.lineTo(1.25, 1.0);
  s.lineTo(1.1, 1.72);
  s.quadraticCurveTo(1.05, 1.8, 0.8, 1.8);
  s.lineTo(-1.9, 1.8);
  s.quadraticCurveTo(-2.2, 1.8, -2.2, 1.5);
  s.lineTo(-2.2, 0.4);
  s.quadraticCurveTo(-2.2, 0.12, -1.9, 0.12);
  s.closePath();
  return s;
}

export function buildCarMesh(type, rng) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const group = new THREE.Group();
  const paint = type === 'sedan' || type === 'pickup' ? pick(rng, PAINTS) : spec.color;
  const bodyMat = new THREE.MeshPhongMaterial({ color: paint, shininess: 70, specular: 0x777777 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x16222e, shininess: 120, specular: 0xaaccdd });
  const isVan = type === 'van';
  const isSports = type === 'sports';
  const bodyLen = isVan ? 4.6 : isSports ? 4.4 : 4.2;
  const bodyTop = isSports ? 0.72 : 0.84;

  // Curved lower body.
  const bodyGeo = isVan
    ? extrudeProfile(vanBodyShape(), 1.9, 0.1)
    : extrudeProfile(sedanBodyShape(bodyLen, bodyTop), 1.86, 0.1);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Sloped glass cabin (the van's tall body already includes its cabin).
  if (!isVan) {
    const cabLen = type === 'pickup' ? 1.9 : 2.3;
    const x1 = type === 'pickup' ? 0.75 : 1.05;
    const roof = isSports ? 1.1 : 1.28;
    const cabinGeo = extrudeProfile(cabinShape(x1 - cabLen, x1, 0.78, roof), 1.6, 0.08);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.castShadow = true;
    group.add(cabin);
    // Pickup bed rails behind the short cabin.
    if (type === 'pickup') {
      const railMat = bodyMat;
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 1.9), railMat);
        rail.position.set(sx * 0.88, 0.92, -1.15);
        group.add(rail);
      }
      const tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.5, 0.1), railMat);
      tailgate.position.set(0, 0.62, -2.05);
      group.add(tailgate);
    }
  } else {
    // Van side windows: dark glass bands on both flanks.
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 2.4), glassMat);
      win.position.set(sx * 0.96, 1.35, -0.2);
      group.add(win);
    }
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.08), glassMat);
    shield.position.set(0, 1.35, 1.62);
    shield.rotation.x = -0.35;
    group.add(shield);
  }

  // Chrome bumpers, front and rear.
  const bumperMat = new THREE.MeshPhongMaterial({ color: 0xb8bcc0, shininess: 120, specular: 0xffffff });
  for (const sz of [1, -1]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.3), bumperMat);
    bumper.position.set(0, 0.32, sz * (bodyLen / 2 + 0.02));
    group.add(bumper);
  }
  // Round headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), headMat);
    h.scale.set(1, 0.75, 0.6);
    h.position.set(x, 0.62, bodyLen / 2 + 0.06);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.08), new THREE.MeshBasicMaterial({ color: 0xd81f1f }));
    t.position.set(x, 0.66, -bodyLen / 2 - 0.04);
    group.add(t);
  }
  // Side mirrors.
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), bodyMat);
    m.position.set(sx * 1.02, 1.02, 0.85);
    group.add(m);
  }
  if (isSports) {
    // Low rear wing on two struts.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.42), bodyMat);
    wing.position.set(0, 1.04, -1.98);
    wing.rotation.x = -0.1;
    group.add(wing);
    for (const sx of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), bodyMat);
      strut.position.set(sx, 0.92, -1.98);
      group.add(strut);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf2e14a })
    );
    sign.position.set(0, 1.42, -0.1);
    group.add(sign);
  }
  if (type === 'cruiser') {
    // White roof panel + flashing light bar with round domes.
    const roofPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.06, 1.5),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })
    );
    roofPanel.position.set(0, 1.31, -0.1);
    group.add(roofPanel);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xdddddd })
    );
    bar.position.set(0, 1.38, -0.1);
    group.add(bar);
    const lightR = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a })
    );
    lightR.scale.y = 0.7;
    lightR.position.set(-0.32, 1.48, -0.1);
    const lightB = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x2a5aff })
    );
    lightB.scale.y = 0.7;
    lightB.position.set(0.32, 1.48, -0.1);
    group.add(lightR, lightB);
    group.userData.lights = [lightR, lightB];
  }

  // Round wheels: torus tires + hubcap discs. Each wheel is a spinner group
  // (rotation.x spins the tire) inside a steer group (rotation.y steers).
  const tireGeo = new THREE.TorusGeometry(0.3, 0.11, 10, 22);
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.36, 12);
  const hubMat = new THREE.MeshPhongMaterial({ color: 0xc8ccd0, shininess: 100, specular: 0xffffff });
  const wheelZ = bodyLen / 2 - 0.85;
  group.userData.wheels = [];
  group.userData.wheelSteers = [];
  const wheelPositions = [
    [-0.95, 0.41, wheelZ, true],
    [0.95, 0.41, wheelZ, true],
    [-0.95, 0.41, -wheelZ, false],
    [0.95, 0.41, -wheelZ, false],
  ];
  for (const [x, y, z, front] of wheelPositions) {
    const steer = new THREE.Group();
    steer.position.set(x, y, z);
    const spinner = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    spinner.add(tire, hub);
    steer.add(spinner);
    group.add(steer);
    group.userData.wheels.push(spinner);
    if (front) group.userData.wheelSteers.push(steer);
  }
  group.userData.spec = spec;
  group.userData.type = type;
  return group;
}

// A car entity: mesh + arcade driving state.
export class Car {
  constructor(mesh, type) {
    this.mesh = mesh;
    this.type = type;
    this.spec = CAR_TYPES[type];
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this.stolen = false;
    this.health = 100;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  // Arcade driving step. throttle -1..1, steerInput -1..1, dt seconds.
  drive(throttle, steerInput, dt, handbrake) {
    const s = this.spec;
    const targetSteer = steerInput * 0.55;
    this.steer = angleLerp(this.steer, targetSteer, 1 - Math.exp(-8 * dt));
    const accel = throttle > 0 ? s.accel : s.accel * 0.7;
    this.speed += throttle * accel * dt;
    if (throttle === 0) this.speed -= Math.sign(this.speed) * 6 * dt;
    if (handbrake) this.speed -= Math.sign(this.speed) * 26 * dt;
    this.speed = clamp(this.speed, -s.speed * 0.45, s.speed);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    const turnRate = this.steer * clamp(Math.abs(this.speed) / 8, 0, 1) * 1.9;
    this.heading += turnRate * Math.sign(this.speed || 1) * dt * (this.speed >= 0 ? 1 : -1);
    const f = this.forward;
    this.pos.addScaledVector(f, this.speed * dt);
    this.mesh.position.copy(this.pos);
    this.mesh.position.y = 0;
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels || [];
    for (let i = 0; i < wheels.length; i++) {
      wheels[i].rotation.x += this.speed * dt * 2.4;
    }
    const steers = this.mesh.userData.wheelSteers || [];
    for (const st of steers) st.rotation.y = this.steer * 0.5;
  }
}

// Traffic: cars that loop the road grid, turning at intersections.
export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.spawnTimer = 0;
  }

  spawnCar(type, x, z, heading) {
    const mesh = buildCarMesh(type, this.rng);
    const car = new Car(mesh, type);
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.driver = 'traffic';
    car.speed = rand(this.rng, 8, 14);
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  spawnParked(type, x, z, heading) {
    const mesh = buildCarMesh(type, this.rng);
    const car = new Car(mesh, type);
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.driver = null;
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  populate(count) {
    const types = ['sedan', 'taxi', 'pickup', 'van', 'sedan', 'taxi'];
    for (let i = 0; i < count; i++) {
      const road = pick(this.rng, this.cityRoadLines());
      const along = rand(this.rng, -200, 200);
      const horizontal = this.rng() < 0.5;
      const x = horizontal ? along : road;
      const z = horizontal ? road : along;
      const heading = horizontal ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : this.rng() < 0.5 ? 0 : Math.PI;
      if (this.city.pointBlocked(x, z, 3)) continue;
      this.spawnCar(pick(this.rng, types), x, z, heading);
    }
    // A few parked cars near the curb for the player to steal.
    const parkedSpots = [
      [-26, -100, Math.PI / 2],
      [30, 30, -Math.PI / 2],
      [-100, 26, 0],
      [100, -30, Math.PI],
      [180, 30, Math.PI / 2],
    ];
    for (const [x, z, h] of parkedSpots) {
      this.spawnParked(pick(this.rng, ['sedan', 'sports', 'pickup']), x, z, h);
    }
  }

  cityRoadLines() {
    return [-198, -154, -110, -66, -22, 22, 66, 110, 154, 198];
  }

  nearestCar(x, z, maxDist, predicate) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (predicate && !predicate(c)) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  update(dt, playerPos) {
    for (const car of this.cars) {
      if (car.driver !== 'traffic') continue;
      // Follow the road: at an intersection, sometimes turn.
      const road = this.city.nearestRoad(car.pos.x, car.pos.z);
      const targetSpeed = 10 + Math.sin(car.pos.x * 0.01 + car.pos.z * 0.013) * 2;
      car.speed = clamp(car.speed + (targetSpeed - car.speed) * dt, 0, 16);
      // Steer back toward the road line.
      let wantHeading = car.heading;
      if (road.axis === 'z') {
        const along = Math.sin(car.heading) > 0 ? Math.PI / 2 : -Math.PI / 2;
        wantHeading = along;
        const off = car.pos.z - road.line;
        car.pos.z -= off * 0.5 * dt;
      } else {
        const along = Math.cos(car.heading) > 0 ? 0 : Math.PI;
        wantHeading = along;
        const off = car.pos.x - road.line;
        car.pos.x -= off * 0.5 * dt;
      }
      // Random turn at intersections.
      if (Math.abs(car.pos.x % 44) < 2.5 && Math.abs(car.pos.z % 44) < 2.5) {
        if (this.rng() < dt * 0.35) {
          car.heading += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        }
      }
      car.heading = angleLerp(car.heading, wantHeading, 1 - Math.exp(-2.5 * dt));
      const f = car.forward;
      car.pos.addScaledVector(f, car.speed * dt);
      // Keep inside the city.
      if (Math.abs(car.pos.x) > 215 || Math.abs(car.pos.z) > 215) {
        car.heading += Math.PI;
      }
      // Gentle separation from the player so traffic does not pile up.
      if (playerPos) {
        const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
        if (d < 4 && d > 0.01) {
          car.speed = Math.max(0, car.speed - 8 * dt);
        }
      }
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      const wheels = car.mesh.userData.wheels || [];
      for (const w of wheels) w.rotation.x += car.speed * dt * 2.4;
    }
  }
}
