// ZENITH — wanted system. Heat 0..100 maps to 0..5 stars; crimes add heat,
// quiet time decays it. At 1+ stars police cars spawn and chase; if a police
// car catches the player on foot, the player is busted.
import { CONFIG } from './config.js';

export class Wanted {
  constructor(world) {
    this.world = world;
    this.heat = 0;
    this.stars = 0;
    this.quietTimer = 0;
    this.police = [];
    this.bustedTimer = 0;
    this.maxPolice = 0;
  }

  addHeat(n) {
    this.heat = Math.min(100, this.heat + n);
    this.quietTimer = 0;
    this.updateStars();
  }

  updateStars() {
    const stars = Math.min(5, Math.floor(this.heat / CONFIG.heatPerStar));
    if (stars !== this.stars) {
      this.stars = stars;
      this.world.hud.setStars(stars);
      if (stars >= 2) this.world.hud.toast(`Wanted level ${stars} — lose the cops!`);
    }
    this.maxPolice = this.stars >= 4 ? 3 : this.stars >= 2 ? 2 : this.stars >= 1 ? 1 : 0;
  }

  update(dt) {
    // Quiet time decays heat; any crime resets the quiet clock.
    if (this.heat > 0) {
      this.quietTimer += dt;
      if (this.quietTimer > 8) {
        this.heat = Math.max(0, this.heat - CONFIG.heatDecayPerSec * dt);
        this.updateStars();
      }
    }
    const player = this.world.player;
    // Spawn police up to the star allowance, at road points near the player.
    while (this.police.length < this.maxPolice) {
      const a = Math.random() * Math.PI * 2;
      const d = 55 + Math.random() * 25;
      const x = player.pos.x + Math.cos(a) * d;
      const z = player.pos.z + Math.sin(a) * d;
      const car = this.world.vehicles.spawnPolice(x, z);
      this.police.push(car);
      this.world.audio.siren(true);
    }
    // Despawn police when the heat is gone.
    if (this.maxPolice === 0 && this.police.length > 0) {
      for (const car of this.police) this.world.vehicles.removeCar(car);
      this.police = [];
      this.world.audio.siren(false);
    }
    // Remove wrecked police cars.
    for (const car of [...this.police]) {
      if (car.health <= 0) {
        this.world.vehicles.removeCar(car);
        this.police = this.police.filter((c) => c !== car);
        this.addHeat(CONFIG.heatKillCop);
      }
    }
    // Busted check: a police car sitting on an on-foot player.
    if (player.onFoot && this.police.length > 0) {
      let close = false;
      for (const car of this.police) {
        const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
        if (d < 3.2) close = true;
      }
      if (close) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 2) this.bust();
      } else {
        this.bustedTimer = 0;
      }
    } else {
      this.bustedTimer = 0;
    }
  }

  bust() {
    const world = this.world;
    world.money = Math.max(0, world.money - CONFIG.bustedFine);
    world.hud.setMoney(world.money);
    this.heat = 0;
    this.stars = 0;
    this.bustedTimer = 0;
    world.hud.setStars(0);
    for (const car of this.police) world.vehicles.removeCar(car);
    this.police = [];
    world.audio.siren(false);
    const car = world.vehicles.playerCar();
    if (car) {
      car.driver = 'parked';
      world.player.exitCar();
    }
    world.player.teleport(0, 40, Math.PI);
    world.player.heal(CONFIG.startHealth);
    world.state = 'busted';
    world.hud.showBusted(CONFIG.bustedFine);
    world.saveGame();
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.bustedTimer = 0;
    this.world.hud.setStars(0);
    for (const car of this.police) this.world.vehicles.removeCar(car);
    this.police = [];
    this.world.audio.siren(false);
  }
}
