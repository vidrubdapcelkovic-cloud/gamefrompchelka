class CreatureSystem {
  constructor(scene, onContactDamage) {
    this.scene = scene;
    this.onContactDamage = onContactDamage;
    this.group = scene.physics.add.group();
    this.creatures = [];
    this.nextId = 1;
  }

  spawn(type, x, y) {
    const definition = CreatureCatalog[type];
    if (!definition) throw new Error(`Неизвестный тип существа: ${type}.`);
    const sprite = this.group.create(x, y, 'temporary-slime');
    sprite.body.setSize(24, 18);
    sprite.setCollideWorldBounds(true);
    const creature = {
      id: `creature-${this.nextId++}`, type, health: definition.maxHealth,
      state: 'idle', sprite, active: true, lastAttackTime: -Infinity,
      spawnX: x, spawnY: y
    };
    this.creatures.push(creature);
    return creature;
  }

  update(time, delta, player, playerIsDead) {
    this.creatures.forEach((creature) => {
      if (!creature.active) return;
      const definition = CreatureCatalog[creature.type];
      const dx = player.x - creature.sprite.x;
      const dy = player.y - creature.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (playerIsDead) {
        creature.state = 'idle';
        creature.sprite.setVelocity(0, 0);
      } else {
        if (creature.state === 'idle' && distance <= definition.detectionRadius) {
          creature.state = 'chase';
        }
        if (creature.state === 'chase' && distance > definition.loseRadius) {
          creature.state = 'idle';
        }
        if (creature.state === 'chase' && distance <= definition.attackRange) {
          creature.sprite.setVelocity(0, 0);
          if (time - creature.lastAttackTime >= definition.attackCooldownMs) {
            creature.lastAttackTime = time;
            this.onContactDamage(definition.contactDamage);
          }
        } else if (creature.state === 'chase' && distance > 0) {
          creature.sprite.setVelocity(
            dx / distance * definition.moveSpeed,
            dy / distance * definition.moveSpeed
          );
        } else {
          creature.sprite.setVelocity(0, 0);
        }
      }
      creature.sprite.setDepth(
        (creature.sprite.y + creature.sprite.displayHeight / 2) * WORLD_DEPTH_SCALE
      );
    });
  }

  damage(id, amount) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Некорректный урон: ${amount}.`);
    const creature = this.creatures.find((candidate) => candidate.id === id && candidate.active);
    if (!creature) return 0;
    const actualDamage = Math.min(amount, creature.health);
    creature.health -= actualDamage;
    if (creature.health === 0) {
      creature.active = false;
      creature.state = 'dead';
      creature.sprite.setVelocity(0, 0);
      if (creature.sprite.body) creature.sprite.body.enable = false;
      if (creature.sprite.active) creature.sprite.destroy();
    }
    return actualDamage;
  }

  getNearestAttackable(x, y, radius) {
    const radiusSquared = radius * radius;
    return this.creatures.filter((creature) => creature.active).reduce((nearest, creature) => {
      const dx = creature.sprite.x - x;
      const dy = creature.sprite.y - y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > radiusSquared) return nearest;
      if (!nearest || distanceSquared < nearest.distanceSquared
        || (distanceSquared === nearest.distanceSquared && creature.id < nearest.creature.id)) {
        return { creature, distanceSquared };
      }
      return nearest;
    }, null)?.creature || null;
  }

  getCreatures() {
    return this.creatures.slice();
  }

  clear() {
    this.creatures.forEach((creature) => {
      if (creature.sprite && creature.sprite.active) creature.sprite.destroy();
      creature.active = false;
      creature.state = 'dead';
    });
    this.creatures = [];
    if (this.group) {
      this.group.clear(false, false);
      this.group.destroy();
      this.group = null;
    }
  }
}
