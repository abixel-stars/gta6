// The story of Solmar: five jobs for Leo Marin, courier for Solmar Express,
// who owes the Marea crew and has to work it off, one delivery at a time.
import * as THREE from 'three';
import { LANDMARKS } from './city.js';
import { money } from './util.js';

// Each step: text shown in the HUD, a target point, and how close counts.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Run',
    briefing:
      'Mama Inez needs a package at Marina Bay. Take the courier van from the depot and drive it down south. Easy money.',
    reward: 150,
    steps: [
      { text: 'Get in the courier van at the depot', target: LANDMARKS.depot, radius: 6, needCar: 'van' },
      { text: 'Deliver the package to Marina Bay', target: LANDMARKS.marina, radius: 8, needCar: 'van' },
    ],
  },
  {
    id: 'm2',
    title: 'Borrowed Wheels',
    briefing:
      'A Cometa GT is parked outside the Grand Solmar Hotel. "Borrow" it and bring it to Ray\'s Garage. The owner will not miss it. Probably.',
    reward: 250,
    steps: [
      { text: 'Steal the Cometa GT at the hotel', target: LANDMARKS.hotel, radius: 7, needCar: 'sports' },
      { text: 'Deliver the Cometa GT to Ray\'s Garage', target: LANDMARKS.garage, radius: 8, needCar: 'sports' },
    ],
  },
  {
    id: 'm3',
    title: 'Harbor Lights',
    briefing:
      'Pick up a sealed crate at the harbor and take it to the Old Town warehouse. The harbor crew asks no questions. Neither should you.',
    reward: 400,
    steps: [
      { text: 'Pick up the crate at the harbor', target: LANDMARKS.harbor, radius: 7 },
      { text: 'Deliver the crate to the Old Town warehouse', target: LANDMARKS.warehouse, radius: 8 },
    ],
  },
  {
    id: 'm4',
    title: 'Heat Wave',
    briefing:
      'The police are onto you. Lose the heat and get to the Las Palmas safehouse without getting busted. Stay off the main roads.',
    reward: 500,
    startWanted: 3,
    steps: [
      { text: 'Lose the cops and reach the Las Palmas safehouse', target: LANDMARKS.safehouse, radius: 8, needWantedBelow: 3 },
    ],
  },
  {
    id: 'm5',
    title: 'The Big Score',
    briefing:
      'One last job and the debt is paid. Take the Marea package to the Solmar Grand penthouse garage. Every cop in the city will be looking for you.',
    reward: 1000,
    startWanted: 2,
    steps: [
      { text: 'Pick up the Marea package at the depot', target: LANDMARKS.depot, radius: 6 },
      { text: 'Deliver it to the Solmar Grand penthouse garage', target: LANDMARKS.penthouse, radius: 8 },
    ],
  },
];

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.completed = new Set();
    this.beacon = null;
    this.beaconRing = null;
    this.buildBeacon();
  }

  buildBeacon() {
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 40, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.visible = false;
    this.world.scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.2, 3.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beaconRing = new THREE.Mesh(ringGeo, ringMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.visible = false;
    this.world.scene.add(this.beaconRing);
  }

  get current() {
    return this.activeIndex >= 0 ? MISSIONS[this.activeIndex] : null;
  }

  get currentStep() {
    const m = this.current;
    return m ? m.steps[this.stepIndex] : null;
  }

  get objectiveText() {
    const step = this.currentStep;
    if (!step) return 'No active job. Visit the depot to start one.';
    return step.text;
  }

  get targetPos() {
    const step = this.currentStep;
    return step ? step.target : null;
  }

  start(index) {
    const m = MISSIONS[index];
    if (!m) return false;
    this.activeIndex = index;
    this.stepIndex = 0;
    if (m.startWanted) {
      this.world.wanted.stars = m.startWanted;
      this.world.wanted.heat = 0;
    }
    this.world.hud.showToast(`${m.title}: ${m.briefing}`);
    this.world.sound.missionDone();
    this.updateBeacon();
    return true;
  }

  startNext() {
    for (let i = 0; i < MISSIONS.length; i++) {
      if (!this.completed.has(MISSIONS[i].id)) return this.start(i);
    }
    return false;
  }

  abort() {
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.updateBeacon();
  }

  updateBeacon() {
    const t = this.targetPos;
    const on = !!t;
    this.beacon.visible = on;
    this.beaconRing.visible = on;
    if (on) {
      this.beacon.position.set(t.x, 20, t.z);
      this.beaconRing.position.set(t.x, 0.35, t.z);
    }
  }

  // Called every frame. Returns 'completed' when a mission finishes.
  update(dt, time) {
    if (!this.current) return null;
    const step = this.currentStep;
    const w = this.world;
    const pos = w.player.inCar && w.player.car ? w.player.car.pos : w.player.pos;
    const d = Math.hypot(pos.x - step.target.x, pos.z - step.target.z);
    // Pulse the beacon.
    if (this.beacon.visible) {
      this.beaconRing.scale.setScalar(1 + Math.sin(time * 3) * 0.15);
      this.beacon.material.opacity = 0.22 + Math.sin(time * 3) * 0.08;
    }
    // Step requirements.
    if (step.needCar) {
      const inRightCar =
        w.player.inCar && w.player.car && w.player.car.type === step.needCar;
      if (!inRightCar) {
        w.hud.setObjective(`${step.text} (need a ${step.needCar === 'van' ? 'courier van' : 'Cometa GT'})`);
        return null;
      }
    }
    if (step.needWantedBelow !== undefined && w.wanted.stars >= step.needWantedBelow) {
      w.hud.setObjective(`${step.text} — wanted ${w.wanted.stars}★, lose the cops first`);
      return null;
    }
    w.hud.setObjective(`${step.text} — ${Math.round(d)}m`);
    if (d < step.radius) {
      this.stepIndex++;
      w.sound.pickup();
      if (this.stepIndex >= this.current.steps.length) {
        const m = this.current;
        this.completed.add(m.id);
        w.player.money += m.reward;
        w.hud.showToast(`Job done: ${m.title} — earned ${money(m.reward)}`);
        w.sound.missionDone();
        this.activeIndex = -1;
        this.stepIndex = 0;
        this.updateBeacon();
        w.saveGame();
        return 'completed';
      }
      this.updateBeacon();
      w.hud.showToast(`Next: ${this.currentStep.text}`);
    }
    return null;
  }
}
