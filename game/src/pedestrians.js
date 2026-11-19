// Pedestrians of Solmar: they stroll the sidewalks, cross at corners, and
// run when things get loud.
import * as THREE from 'three';
import { pick, rand } from './util.js';

const SHIRTS = [0xd84a4a, 0x4a7fc7, 0x53a05a, 0xe8c832, 0x8a5a9a, 0xe07a3a, 0x3a9a8a];

// Solmar locals: names, small talk, a few generous tippers and a few who
// know where the jobs are.
const PED_NAMES = [
  'Rosa', 'Tomas', 'Luz', 'Marco', 'Ana', 'Diego', 'Carmen', 'Luis',
  'Marta', 'Paco', 'Elena', 'Rico', 'Sofia', 'Nico', 'Ines', 'Beto',
];
const PED_LINES = [
  'Beautiful day in Solmar, no? The sea is flat as glass.',
  'You look like a man in a hurry. The Marea crew pays on time, they say.',
  'Careful on the main roads — the police have been jumpy all week.',
  'I saw a Cometa GT parked by the Grand Solmar Hotel. Nice car.',
  'The harbor crew moves crates at night. Ask no questions.',
  'Mama Inez runs this town. Everybody owes her something.',
  'If you need cash, check the sidewalks near the park. People drop things.',
  'The beach is the only quiet place left in this city.',
];
const PED_TIPS = [
  'Here — take this. You look like you need it more than me.',
  'For luck, courier. Spend it before the cops take it.',
];
const PED_HINTS = [
  'Word is the next job starts at the depot. Mama Inez is waiting.',
  'Ray\'s Garage fixes anything, no questions, cash only.',
  'Lose the cops in the Old Town alleys. They hate the tight turns.',
];

export function buildPedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8b88a, 0xc98d5f, 0x8a5a3a, 0xf0c8a0]) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, [0x2a3440, 0x4a3a2a, 0x5a5a5a]) });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.65, 6), pants);
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6), shirt);
  armL.position.set(-0.42, 1.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(body, head, legL, legR, armL, armR);
  // Hair or a hat, so the crowd does not all look the same.
  const roll = rng();
  if (roll < 0.45) {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0x2a1a12, 0x4a2a1a, 0x8a8a8a, 0x1a1a1a]) })
    );
    hair.position.y = 1.76;
    group.add(hair);
  } else if (roll < 0.65) {
    const hatMat = new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8c832, 0xd84a4a, 0x3a6a3a, 0xf2ead8]) });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 10), hatMat);
    crown.position.y = 1.95;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 12), hatMat);
    brim.position.y = 1.86;
    group.add(crown, brim);
  } else if (roll < 0.8) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xc72e2e, 0x2a5a8a, 0x3f7a4a]) })
    );
    cap.position.y = 1.78;
    group.add(cap);
  }
  group.userData.legs = [legL, legR];
  group.userData.arms = [armL, armR];
  return group;
}

export class Pedestrian {
  constructor(mesh, x, z, rng) {
    this.mesh = mesh;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 1.2;
    this.walkPhase = Math.random() * 6;
    this.fleeing = false;
    this.fleeTimer = 0;
    this.health = 100;
    this.target = null;
    // Talk profile: most chat, some tip cash once, some know the jobs.
    const roll = rng ? rng() : Math.random();
    this.name = PED_NAMES[Math.floor((rng ? rng() : Math.random()) * PED_NAMES.length)];
    this.kind = roll < 0.18 ? 'tip' : roll < 0.36 ? 'hint' : 'chat';
    this.line = this.kind === 'tip'
      ? PED_TIPS[Math.floor(Math.random() * PED_TIPS.length)]
      : this.kind === 'hint'
        ? PED_HINTS[Math.floor(Math.random() * PED_HINTS.length)]
        : PED_LINES[Math.floor(Math.random() * PED_LINES.length)];
    this.tipped = false;
    this.talkCooldown = 0;
    // Pinned actors stay where the screenshot stager puts them.
    this.pinned = false;
    this.pickNewTarget();
  }

  // Talk to this pedestrian. Returns { name, line, tip } — tip is a cash
  // amount the first time a generous local is greeted, otherwise 0.
  talk() {
    if (this.talkCooldown > 0) return null;
    this.talkCooldown = 10;
    let tip = 0;
    if (this.kind === 'tip' && !this.tipped) {
      this.tipped = true;
      tip = 10 + Math.floor(Math.random() * 4) * 5;
    }
    return { name: this.name, line: this.line, tip };
  }

  pickNewTarget() {
    // Walk to a nearby sidewalk corner.
    const gx = Math.round((this.pos.x + 220) / 44) * 44 - 220 + (Math.random() < 0.5 ? -9 : 9);
    const gz = Math.round((this.pos.z + 220) / 44) * 44 - 220 + (Math.random() < 0.5 ? -9 : 9);
    this.target = {
      x: Math.max(-208, Math.min(208, gx)),
      z: Math.max(-208, Math.min(208, gz)),
    };
  }

  fleeFrom(x, z) {
    this.fleeing = true;
    this.fleeTimer = 4;
    const dx = this.pos.x - x;
    const dz = this.pos.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this.target = {
      x: this.pos.x + (dx / d) * 30,
      z: this.pos.z + (dz / d) * 30,
    };
  }

  update(dt) {
    if (this.fleeTimer > 0) this.fleeTimer -= dt;
    else this.fleeing = false;
    if (this.talkCooldown > 0) this.talkCooldown -= dt;
    if (this.pinned) return;
    const speed = this.fleeing ? 4.2 : this.speed;
    const dx = this.target.x - this.pos.x;
    const dz = this.target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) {
      this.pickNewTarget();
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, 6 * dt);
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    this.walkPhase += dt * (this.fleeing ? 11 : 6);
    const swing = Math.sin(this.walkPhase) * 0.5;
    const legs = this.mesh.userData.legs;
    const arms = this.mesh.userData.arms;
    if (legs) {
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
    }
    if (arms) {
      arms[0].rotation.x = -swing * 0.7;
      arms[1].rotation.x = swing * 0.7;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }
}

export class Crowd {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.peds = [];
  }

  populate(count) {
    for (let i = 0; i < count; i++) {
      const mesh = buildPedMesh(this.rng);
      const x = rand(this.rng, -200, 200);
      const z = rand(this.rng, -200, 200);
      const ped = new Pedestrian(mesh, x, z, this.rng);
      this.scene.add(mesh);
      this.peds.push(ped);
    }
  }

  update(dt) {
    for (const p of this.peds) p.update(dt);
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius) p.fleeFrom(x, z);
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
