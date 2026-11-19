// Cars of Solmar: building them, driving them, and the traffic that fills
// the streets. Every car is an original boxy low-poly build.
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

export function buildCarMesh(type, rng) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const group = new THREE.Group();
  const paint = type === 'sedan' || type === 'pickup' ? pick(rng, PAINTS) : spec.color;
  const bodyMat = new THREE.MeshLambertMaterial({ color: paint });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const isVan = type === 'van';
  const bodyLen = isVan ? 4.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, bodyLen), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, isVan ? 3.4 : 2.1),
    type === 'van' ? bodyMat : glassMat
  );
  cabin.position.set(0, 1.28, isVan ? 0 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), bodyMat);
    spoiler.position.set(0, 1.05, -2.0);
    group.add(spoiler);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf2e14a })
    );
    sign.position.set(0, 1.72, -0.2);
    group.add(sign);
  }
  if (type === 'cruiser') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xdddddd })
    );
    bar.position.set(0, 1.7, -0.2);
    group.add(bar);
    const lightR = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a })
    );
    lightR.position.set(-0.32, 1.82, -0.2);
    const lightB = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2a5aff })
    );
    lightB.position.set(0.32, 1.82, -0.2);
    group.add(lightR, lightB);
    group.userData.lights = [lightR, lightB];
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheelPositions = [
    [-0.95, 0.38, 1.4],
    [0.95, 0.38, 1.4],
    [-0.95, 0.38, -1.4],
    [0.95, 0.38, -1.4],
  ];
  group.userData.wheels = [];
  for (const [x, y, z] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
    group.userData.wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(x, 0.7, bodyLen / 2 + 0.02);
    group.add(h);
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
      if (i < 2) wheels[i].rotation.y = this.steer * 0.5;
    }
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
