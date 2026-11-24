// ZENITH — story missions. Five jobs in order; each has a glowing beacon
// marker at its current target and a completion rule checked every frame.
import { CONFIG, MISSIONS } from './config.js';

export class Missions {
  constructor(THREE, scene, world) {
    this.THREE = THREE;
    this.scene = scene;
    this.world = world;
    this.defs = MISSIONS;
    this.index = world.save.missionIndex || 0;
    this.waypoint = 0;
    this.shotsAtStart = 0;
    this.hadStars = false;
    this.done = this.index >= this.defs.length;
    this.marker = null;
    this.ring = null;
    this.beaconLight = null;
    this.buildMarker();
    if (!this.done) this.start(this.index);
  }

  buildMarker() {
    // Beacon: a tall additive cylinder plus a pulsing ground ring.
    const geo = new this.THREE.CylinderGeometry(1.6, 2.4, 60, 16, 1, true);
    const mat = new this.THREE.MeshBasicMaterial({
      color: 0xffd24a,
      transparent: true,
      opacity: 0.22,
      side: this.THREE.DoubleSide,
      depthWrite: false,
    });
    this.marker = new this.THREE.Mesh(geo, mat);
    this.marker.visible = false;
    this.scene.add(this.marker);
    const ringGeo = new this.THREE.RingGeometry(3.2, 4.4, 32);
    const ringMat = new this.THREE.MeshBasicMaterial({
      color: 0xffd24a,
      transparent: true,
      opacity: 0.85,
      side: this.THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new this.THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);
    this.beaconLight = new this.THREE.PointLight(0xffd24a, 30, 40, 1.5);
    this.beaconLight.visible = false;
    this.scene.add(this.beaconLight);
  }

  current() {
    return this.done ? null : this.defs[this.index];
  }

  currentTarget() {
    const m = this.current();
    if (!m) return null;
    if (m.type === 'steal') return null; // any car counts; no fixed point
    if (m.waypoints) return m.waypoints[Math.min(this.waypoint, m.waypoints.length - 1)];
    return null;
  }

  start(i) {
    this.index = i;
    this.waypoint = 0;
    this.shotsAtStart = this.world.combat.hits;
    this.hadStars = false;
    const m = this.current();
    if (!m) {
      this.done = true;
      this.setMarker(null);
      this.world.hud.showBanner('ZENITH COMPLETE', 'All five jobs done. The city is yours.');
      return;
    }
    this.world.hud.showBanner(`MISSION ${i + 1}: ${m.name}`, m.brief);
    this.world.hud.setObjective(m.brief);
    this.setMarker(this.currentTarget());
  }

  setMarker(target) {
    const on = !!target;
    this.marker.visible = on;
    this.ring.visible = on;
    this.beaconLight.visible = on;
    if (on) {
      this.marker.position.set(target.x, 30, target.z);
      this.ring.position.set(target.x, 0.12, target.z);
      this.beaconLight.position.set(target.x, 6, target.z);
    }
  }

  advanceWaypoint() {
    const m = this.current();
    this.waypoint += 1;
    if (m.waypoints && this.waypoint >= m.waypoints.length) {
      this.complete();
      return;
    }
    const t = this.currentTarget();
    this.world.hud.toast(t ? `Next: ${t.label}` : 'Next objective');
    this.setMarker(t);
  }

  complete() {
    const m = this.current();
    if (!m) return;
    this.world.money += m.reward;
    this.world.hud.setMoney(this.world.money);
    this.world.hud.showBanner('JOB DONE', `+ $${m.reward} — ${m.name}`);
    this.world.audio.jingle();
    this.world.saveGame();
    this.index += 1;
    if (this.index >= this.defs.length) {
      this.done = true;
      this.setMarker(null);
      this.world.hud.setObjective('All jobs complete. Free roam — Zenith is yours.');
      this.world.hud.showBanner('ZENITH COMPLETE', 'All five jobs done. The city is yours.');
      this.world.saveGame();
      return;
    }
    this.start(this.index);
  }

  update(dt, time) {
    // Beacon pulse.
    if (this.marker.visible) {
      const s = 1 + Math.sin(time * 3) * 0.12;
      this.ring.scale.setScalar(s);
      this.marker.material.opacity = 0.18 + Math.sin(time * 3) * 0.06;
    }
    const m = this.current();
    if (!m || this.world.state !== 'playing') return;
    const player = this.world.player;
    const target = this.currentTarget();
    if (target) {
      const d = Math.hypot(player.pos.x - target.x, player.pos.z - target.z);
      this.world.hud.setDistance(d, target.label);
    } else {
      this.world.hud.setDistance(null, '');
    }
    if (m.type === 'steal') {
      if (!player.onFoot) this.complete();
    } else if (m.type === 'drive-to' || m.type === 'heist') {
      if (target) {
        const d = Math.hypot(player.pos.x - target.x, player.pos.z - target.z);
        if (d < 9) this.advanceWaypoint();
      }
    } else if (m.type === 'escape') {
      if (this.world.wanted.stars >= (m.needStars || 2)) this.hadStars = true;
      if (this.hadStars && this.world.wanted.stars === 0) this.complete();
    } else if (m.type === 'shoot') {
      const done = this.world.combat.hits - this.shotsAtStart;
      this.world.hud.setObjective(`${m.brief}  (${done}/${m.needHits} down)`);
      if (done >= (m.needHits || 5)) this.complete();
    }
  }
}
