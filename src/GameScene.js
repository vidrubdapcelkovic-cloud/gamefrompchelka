const PLAYER_SPEED = 260;
const SURFACE_TILE_INDICES = Object.freeze({ G: 0, S: 1, W: 2, R: 3 });
const WORLD_OBJECT_TYPES = Object.freeze(['TREE', 'ROCK', 'BERRY_BUSH']);
const WORLD_OBJECT_DROPS = Object.freeze({
  TREE: Object.freeze({ itemType: 'WOOD', quantity: 3 }),
  ROCK: Object.freeze({ itemType: 'STONE', quantity: 2 }),
  BERRY_BUSH: Object.freeze({ itemType: 'BERRIES', quantity: 2 })
});
const WORLD_DEPTH_SCALE = 0.1;
const INTERFACE_DEPTH = 2000;
const GROUND_ITEM_PICKUP_RADIUS = 28;
const BUILDING_DISMANTLE_DURATION_MS = 600;
const PLAYER_MELEE_ATTACK = Object.freeze({ damage: 10, radius: 52, cooldownMs: 450 });
const SLIME_SPAWN_CELLS = Object.freeze([
  Object.freeze({ col: 8, row: 8 }), Object.freeze({ col: 39, row: 8 }),
  Object.freeze({ col: 8, row: 28 }), Object.freeze({ col: 39, row: 28 })
]);

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.inventoryModel = new InventoryModel();
    this.craftingModel = new CraftingModel(this.inventoryModel);
    this.playerStatsModel = new PlayerStatsModel();
    this.saveSystem = new SaveSystem();
    this.isApplyingSave = false;
    this.isDeathHandled = false;
    this.createWorld();
    this.createPlayer();
    this.createWorldObjects();
    this.createBuildingSystem();
    this.createCreatureSystem();
    this.createControls();
    this.createCamera();
    this.createInterface();
    this.createInteractionInterface();
    this.createVirtualJoystick();
    this.createInventoryUI();
    this.createCraftingUI();
    this.createSurvivalInterface();
    this.createBuildingInterface();
    this.createCombatInterface();
    this.createSaveInterface();
    this.registerLifecycleHandlers();
  }

  isPlayerDead() {
    return Boolean(
      this.isDeathHandled
      || (this.playerStatsModel && this.playerStatsModel.isDead())
    );
  }

  isModalOpen() {
    return Boolean(
      (this.inventoryUI && this.inventoryUI.isOpen)
      || (this.craftingUI && this.craftingUI.isOpen)
    );
  }

  canMove() {
    return !this.isApplyingSave && !this.isPlayerDead() && !this.isModalOpen();
  }

  canHarvest() {
    return this.canMove() && !(this.buildingSystem && this.buildingSystem.isActive());
  }

  canUseFood() {
    return this.canHarvest() && !(this.holdActionSystem && this.holdActionSystem.active);
  }

  canAttack() {
    return this.canHarvest()
      && !(this.holdActionSystem && this.holdActionSystem.active);
  }

  canBuild() {
    return !this.isApplyingSave && !this.isPlayerDead();
  }

  canOpenPanel() {
    return !this.isApplyingSave
      && !this.isPlayerDead()
      && !(this.buildingSystem && this.buildingSystem.isActive());
  }

  canSelectHotbarSlot() {
    return !this.isApplyingSave && !this.isPlayerDead();
  }

  canSave() {
    return !this.isApplyingSave && !this.isPlayerDead();
  }

  canLoad() {
    return !this.isApplyingSave;
  }

  createWorld() {
    this.worldGrid = new WorldGrid(FixedMapData);
    this.physics.world.setBounds(0, 0, this.worldGrid.worldWidth, this.worldGrid.worldHeight);

    const graphics = this.add.graphics().setDepth(-20);
    graphics.fillStyle(0x527a45, 1);
    graphics.fillRect(0, 0, this.worldGrid.worldWidth, this.worldGrid.worldHeight);

    graphics.lineStyle(2, 0x5f8b50, 0.55);
    for (let x = 0; x <= this.worldGrid.worldWidth; x += 80) {
      graphics.lineBetween(x, 0, x, this.worldGrid.worldHeight);
    }
    for (let y = 0; y <= this.worldGrid.worldHeight; y += 80) {
      graphics.lineBetween(0, y, this.worldGrid.worldWidth, y);
    }

    const decorations = [
      { x: 220, y: 220, color: 0x294d32 },
      { x: 480, y: 720, color: 0x79593a },
      { x: 760, y: 300, color: 0x294d32 },
      { x: 1120, y: 850, color: 0x79593a },
      { x: 1420, y: 260, color: 0x294d32 },
      { x: 1740, y: 690, color: 0x79593a },
      { x: 1840, y: 1040, color: 0x294d32 }
    ];

    decorations.forEach((item, index) => {
      graphics.fillStyle(0x1c3324, 0.25);
      graphics.fillEllipse(item.x + 5, item.y + 14, 56, 24);
      graphics.fillStyle(item.color, 1);
      if (index % 2 === 0) {
        graphics.fillCircle(item.x, item.y, 28);
        graphics.fillCircle(item.x - 20, item.y + 5, 18);
        graphics.fillCircle(item.x + 20, item.y + 5, 18);
      } else {
        graphics.fillRoundedRect(item.x - 26, item.y - 20, 52, 40, 10);
        graphics.lineStyle(3, 0x5b402c, 1);
        graphics.strokeRoundedRect(item.x - 26, item.y - 20, 52, 40, 10);
      }
    });

    graphics.lineStyle(16, 0xe6c766, 1);
    graphics.strokeRect(8, 8, this.worldGrid.worldWidth - 16, this.worldGrid.worldHeight - 16);
    graphics.lineStyle(4, 0x3b2f21, 1);
    graphics.strokeRect(18, 18, this.worldGrid.worldWidth - 36, this.worldGrid.worldHeight - 36);

    this.createSurfaceTilemap();
  }

  createSurfaceTilemap() {
    const textureKey = 'temporary-surface-tiles';
    const tileSize = FixedMapData.tileSize;

    if (!this.textures.exists(textureKey)) {
      const tiles = this.make.graphics({ x: 0, y: 0, add: false });

      // Grass tile (index 0).
      tiles.fillStyle(0x527a45, 1);
      tiles.fillRect(0, 0, tileSize, tileSize);
      tiles.fillStyle(0x668d55, 1);
      tiles.fillRect(5, 7, 3, 3);
      tiles.fillRect(22, 19, 3, 3);
      tiles.fillStyle(0x416a3b, 1);
      tiles.fillRect(14, 25, 2, 4);

      // Sand tile (index 1).
      tiles.fillStyle(0xc9aa62, 1);
      tiles.fillRect(tileSize, 0, tileSize, tileSize);
      tiles.fillStyle(0xe0c47b, 1);
      tiles.fillRect(tileSize + 6, 6, 4, 2);
      tiles.fillRect(tileSize + 20, 23, 5, 2);
      tiles.fillStyle(0xaa884c, 1);
      tiles.fillRect(tileSize + 15, 14, 3, 3);

      // Water tile (index 2).
      tiles.fillStyle(0x2f6f9f, 1);
      tiles.fillRect(tileSize * 2, 0, tileSize, tileSize);
      tiles.fillStyle(0x4d91ba, 1);
      tiles.fillRect(tileSize * 2 + 3, 7, 12, 3);
      tiles.fillRect(tileSize * 2 + 17, 20, 12, 3);
      tiles.fillStyle(0x23577f, 1);
      tiles.fillRect(tileSize * 2 + 9, 27, 14, 2);

      // Rocky ground tile (index 3).
      tiles.fillStyle(0x696c70, 1);
      tiles.fillRect(tileSize * 3, 0, tileSize, tileSize);
      tiles.fillStyle(0x85898d, 1);
      tiles.fillRect(tileSize * 3 + 4, 5, 8, 6);
      tiles.fillRect(tileSize * 3 + 20, 19, 7, 8);
      tiles.fillStyle(0x505358, 1);
      tiles.fillRect(tileSize * 3 + 13, 14, 6, 5);

      tiles.generateTexture(textureKey, tileSize * 4, tileSize);
      tiles.destroy();
    }

    const numericMap = FixedMapData.tiles.map((row) => (
      Array.from(row, (tileType) => SURFACE_TILE_INDICES[tileType])
    ));

    this.surfaceMap = this.make.tilemap({
      data: numericMap,
      tileWidth: tileSize,
      tileHeight: tileSize
    });

    const tileset = this.surfaceMap.addTilesetImage(
      textureKey,
      textureKey,
      tileSize,
      tileSize,
      0,
      0,
      0
    );

    this.surfaceLayer = this.surfaceMap.createLayer(0, tileset, 0, 0);
    this.surfaceLayer.setDepth(-10);

    const waterTileIndex = SURFACE_TILE_INDICES.W;
    this.surfaceLayer.setCollision([waterTileIndex], true, true);
    this.surfaceLayer.calculateFacesWithin(
      0,
      0,
      FixedMapData.columns,
      FixedMapData.rows
    );
    this.validateSurfaceCollision(waterTileIndex);
  }

  validateSurfaceCollision(waterTileIndex) {
    const findFirstCell = (tileType) => {
      for (let row = 0; row < FixedMapData.rows; row += 1) {
        const col = FixedMapData.tiles[row].indexOf(tileType);
        if (col !== -1) return { col, row };
      }
      return null;
    };

    const waterCell = findFirstCell('W');
    const grassCell = findFirstCell('G');

    if (waterCell === null || grassCell === null) {
      throw new Error('Проверка коллизий карты невозможна: не найдена клетка W или G.');
    }

    const waterTile = this.surfaceLayer.getTileAt(waterCell.col, waterCell.row);
    if (
      waterTile === null
      || waterTile.index !== waterTileIndex
      || waterTile.collides !== true
    ) {
      throw new Error(
        `Неверная коллизия клетки W (col: ${waterCell.col}, row: ${waterCell.row}, `
        + `ожидался индекс: ${waterTileIndex}, фактический индекс: ${waterTile ? waterTile.index : 'нет тайла'}, `
        + `collides: ${waterTile ? waterTile.collides : 'нет тайла'}).`
      );
    }

    const grassTileIndex = SURFACE_TILE_INDICES.G;
    const grassTile = this.surfaceLayer.getTileAt(grassCell.col, grassCell.row);
    if (
      grassTile === null
      || grassTile.index !== grassTileIndex
      || grassTile.collides !== false
    ) {
      throw new Error(
        `Неверная коллизия клетки G (col: ${grassCell.col}, row: ${grassCell.row}, `
        + `ожидался индекс: ${grassTileIndex}, фактический индекс: ${grassTile ? grassTile.index : 'нет тайла'}, `
        + `collides: ${grassTile ? grassTile.collides : 'нет тайла'}).`
      );
    }
  }

  createPlayer() {
    const playerTexture = this.make.graphics({ x: 0, y: 0, add: false });
    playerTexture.fillStyle(0x163a59, 1);
    playerTexture.fillRoundedRect(0, 0, 40, 40, 8);
    playerTexture.fillStyle(0x4fc3f7, 1);
    playerTexture.fillRoundedRect(4, 4, 32, 32, 6);
    playerTexture.fillStyle(0xffffff, 1);
    playerTexture.fillCircle(14, 17, 4);
    playerTexture.fillCircle(26, 17, 4);
    playerTexture.generateTexture('player', 40, 40);
    playerTexture.destroy();

    const { col, row } = FixedMapData.playerStart;

    if (!this.worldGrid.isInside(col, row)) {
      throw new Error(`Стартовая клетка игрока находится вне карты (col: ${col}, row: ${row}).`);
    }

    if (!this.worldGrid.isWalkable(col, row)) {
      const tileType = this.worldGrid.getTileType(col, row);
      throw new Error(
        `Стартовая клетка игрока непроходима (col: ${col}, row: ${row}, тип: ${tileType ?? 'неизвестен'}).`
      );
    }

    const startPosition = this.worldGrid.cellToWorldCenter(col, row);
    if (startPosition === null) {
      throw new Error(
        `Не удалось преобразовать стартовую клетку игрока в координаты мира (col: ${col}, row: ${row}).`
      );
    }

    this.player = this.physics.add.sprite(startPosition.x, startPosition.y, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(40, 40);
    this.playerMapCollider = this.physics.add.collider(this.player, this.surfaceLayer);
    this.updateWorldDepth(this.player);
  }

  createWorldObjects() {
    this.validateWorldObjects();
    this.createWorldObjectTextures();
    this.createGroundItemTextures();

    this.worldObjects = [];
    this.treeBlockers = [];
    this.interactionTargets = [];
    this.runtimeWorldObjects = new Map();
    this.blockingWorldObjects = this.physics.add.staticGroup();
    this.groundItemSystem = new GroundItemSystem(this, {
      WOOD: 'temporary-ground-wood',
      STONE: 'temporary-ground-stone',
      SLIME_GEL: 'temporary-slime-gel',
      BERRIES: 'temporary-ground-berries',
      STONE_AXE: 'temporary-stone-axe',
      STONE_PICKAXE: 'temporary-stone-pickaxe'
    });

    FixedWorldObjects.forEach((objectData) => {
      const position = this.worldGrid.cellToWorldCenter(objectData.col, objectData.row);
      const textureKey = {
        TREE: 'temporary-tree',
        ROCK: 'temporary-rock',
        BERRY_BUSH: 'temporary-berry-bush'
      }[objectData.type];
      const gameObject = objectData.type === 'ROCK'
        ? this.blockingWorldObjects.create(position.x, position.y, textureKey)
        : this.add.image(position.x, position.y, textureKey);

      gameObject.setDataEnabled();
      gameObject.setData('id', objectData.id);
      gameObject.setData('type', objectData.type);
      gameObject.setData('col', objectData.col);
      gameObject.setData('row', objectData.row);
      this.updateWorldDepth(gameObject);

      let interactionX = gameObject.x;
      let interactionY = gameObject.y;
      let blockerObject = null;

      if (objectData.type === 'TREE') {
        const treeBounds = gameObject.getBounds();
        const blocker = this.blockingWorldObjects.create(
          treeBounds.centerX,
          treeBounds.bottom - 8,
          'temporary-tree-blocker'
        );
        blocker.setVisible(false);
        blocker.setDataEnabled();
        blocker.setData('ownerId', objectData.id);
        blocker.setData('type', objectData.type);
        blocker.setData('col', objectData.col);
        blocker.setData('row', objectData.row);
        this.treeBlockers.push(blocker);
        blockerObject = blocker;
        interactionX = blocker.x;
        interactionY = blocker.y;
      } else if (objectData.type === 'ROCK') {
        gameObject.body.setSize(24, 18);
        gameObject.body.setOffset(4, 14);
        gameObject.refreshBody();
        blockerObject = gameObject;
      }

      this.worldObjects.push(gameObject);
      const interactionTarget = {
        id: objectData.id,
        type: objectData.type,
        col: objectData.col,
        row: objectData.row,
        interactionX,
        interactionY,
        visualObject: gameObject
      };
      this.interactionTargets.push(interactionTarget);
      this.runtimeWorldObjects.set(objectData.id, {
        id: objectData.id,
        type: objectData.type,
        col: objectData.col,
        row: objectData.row,
        active: true,
        visualObject: gameObject,
        blockerObject,
        interactionTarget
      });
    });

    this.validateTreeBlockerGeometry();
    this.interactionSystem = new InteractionSystem(72);
    this.interactionSystem.setTargets(this.interactionTargets);
    this.worldObjectsCollider = this.physics.add.collider(
      this.player,
      this.blockingWorldObjects
    );
  }

  validateWorldObjects() {
    const ids = new Set();
    const occupiedCells = new Set();
    const allowedTypes = new Set(WORLD_OBJECT_TYPES);
    const start = FixedMapData.playerStart;

    FixedWorldObjects.forEach((objectData) => {
      const details = `id: ${objectData.id}, type: ${objectData.type}, col: ${objectData.col}, row: ${objectData.row}`;

      if (ids.has(objectData.id)) {
        throw new Error(`Повторяющийся id объекта мира (${details}).`);
      }
      ids.add(objectData.id);

      if (!allowedTypes.has(objectData.type)) {
        throw new Error(`Недопустимый тип объекта мира (${details}).`);
      }

      if (!Number.isInteger(objectData.col) || !Number.isInteger(objectData.row)) {
        throw new Error(`Координаты объекта мира должны быть целыми (${details}).`);
      }

      if (!this.worldGrid.isInside(objectData.col, objectData.row)) {
        throw new Error(`Объект мира находится вне карты (${details}).`);
      }

      if (!this.worldGrid.isWalkable(objectData.col, objectData.row)) {
        throw new Error(`Объект мира находится на непроходимой клетке (${details}).`);
      }

      const cellKey = `${objectData.col},${objectData.row}`;
      if (occupiedCells.has(cellKey)) {
        throw new Error(`Несколько объектов мира занимают одну клетку (${details}).`);
      }
      occupiedCells.add(cellKey);

      const distanceFromStart = Math.max(
        Math.abs(objectData.col - start.col),
        Math.abs(objectData.row - start.row)
      );
      if (distanceFromStart <= 2) {
        throw new Error(`Объект мира находится слишком близко к старту игрока (${details}).`);
      }
    });
  }

  createBuildingSystem() {
    this.lastFacingDirection = 'down';
    this.currentBuildTarget = null;
    this.buildingSystem = new BuildingSystem(
      this,
      this.worldGrid,
      this.blockingWorldObjects,
      { WOOD_WALL: 'temporary-wood-wall' }
    );
    this.interactionTargetValidator = (target) => this.isInteractionTargetValid(target);
    this.refreshInteractionTargets();
  }

  isInteractionTargetValid(target) {
    if (target.type !== 'WOOD_WALL') return true;
    const facingVectors = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 }
    };
    const facing = facingVectors[this.lastFacingDirection];
    if (!facing) return false;
    const offsetX = target.interactionX - this.player.x;
    const offsetY = target.interactionY - this.player.y;
    return offsetX * facing.x + offsetY * facing.y > 0;
  }

  refreshInteractionTargets() {
    const targets = [];
    if (this.runtimeWorldObjects) {
      this.runtimeWorldObjects.forEach((object) => {
        if (object.active) targets.push(object.interactionTarget);
      });
    }
    if (this.buildingSystem) {
      this.buildingSystem.getPlacements().forEach((building) => {
        const position = this.worldGrid.cellToWorldCenter(building.col, building.row);
        if (position === null) {
          throw new Error(
            `Не удалось создать цель постройки ${building.id} `
            + `(тип: ${building.buildType}, col: ${building.col}, row: ${building.row}).`
          );
        }
        targets.push({
          id: building.id,
          type: building.buildType,
          buildType: building.buildType,
          col: building.col,
          row: building.row,
          interactionX: position.x,
          interactionY: position.y,
          visualObject: building.visualObject,
          building
        });
      });
    }
    this.interactionTargets = targets;
    this.interactionSystem.setTargets(targets);
  }

  createCreatureSystem() {
    this.creatureSystem = new CreatureSystem(this);
    SLIME_SPAWN_CELLS.forEach(({ col, row }) => {
      if (!this.worldGrid.isWalkable(col, row)
        || Array.from(this.runtimeWorldObjects.values()).some(
          (object) => object.active && object.col === col && object.row === row
        )) {
        throw new Error(`Недопустимая клетка появления слизня (${col}, ${row}).`);
      }
      const position = this.worldGrid.cellToWorldCenter(col, row);
      this.creatureSystem.spawn('SLIME', position.x, position.y, `SLIME_${col}_${row}`);
    });
    this.creatureMapCollider = this.physics.add.collider(this.creatureSystem.group, this.surfaceLayer);
    this.creatureObstacleCollider = this.physics.add.collider(
      this.creatureSystem.group,
      this.blockingWorldObjects
    );
  }

  createWorldObjectTextures() {
    if (!this.textures.exists('temporary-tree')) {
      const tree = this.make.graphics({ x: 0, y: 0, add: false });
      tree.fillStyle(0x76502f, 1);
      tree.fillRect(19, 34, 10, 30);
      tree.fillStyle(0x285a35, 1);
      tree.fillCircle(24, 22, 20);
      tree.fillStyle(0x397343, 1);
      tree.fillCircle(14, 25, 12);
      tree.fillCircle(34, 25, 12);
      tree.fillStyle(0x4b8a50, 1);
      tree.fillRect(19, 9, 10, 6);
      tree.generateTexture('temporary-tree', 48, 64);
      tree.destroy();
    }

    if (!this.textures.exists('temporary-rock')) {
      const rock = this.make.graphics({ x: 0, y: 0, add: false });
      rock.fillStyle(0x555b61, 1);
      rock.fillRoundedRect(2, 7, 28, 23, 8);
      rock.fillStyle(0x838a91, 1);
      rock.fillRoundedRect(7, 5, 17, 12, 5);
      rock.fillStyle(0x3f4449, 1);
      rock.fillRect(20, 19, 6, 5);
      rock.generateTexture('temporary-rock', 32, 32);
      rock.destroy();
    }

    if (!this.textures.exists('temporary-tree-blocker')) {
      const blocker = this.make.graphics({ x: 0, y: 0, add: false });
      blocker.fillStyle(0xffffff, 0);
      blocker.fillRect(0, 0, 18, 16);
      blocker.generateTexture('temporary-tree-blocker', 18, 16);
      blocker.destroy();
    }

    if (!this.textures.exists('temporary-berry-bush')) {
      const bush = this.make.graphics({ x: 0, y: 0, add: false });
      bush.fillStyle(0x315f35, 1);
      bush.fillCircle(10, 18, 9);
      bush.fillCircle(21, 17, 10);
      bush.fillCircle(16, 10, 9);
      bush.fillStyle(0xc53f57, 1);
      bush.fillCircle(9, 14, 3);
      bush.fillCircle(22, 13, 3);
      bush.fillCircle(17, 22, 3);
      bush.generateTexture('temporary-berry-bush', 32, 32);
      bush.destroy();
    }

    if (!this.textures.exists('temporary-wood-wall')) {
      const wall = this.make.graphics({ x: 0, y: 0, add: false });
      wall.fillStyle(0x744a2b, 1);
      wall.fillRect(1, 2, 30, 28);
      wall.fillStyle(0xa87343, 1);
      wall.fillRect(3, 5, 26, 6);
      wall.fillRect(3, 16, 26, 6);
      wall.fillStyle(0x4f321f, 1);
      wall.fillRect(7, 2, 3, 28);
      wall.fillRect(22, 2, 3, 28);
      wall.generateTexture('temporary-wood-wall', 32, 32);
      wall.destroy();
    }

    if (!this.textures.exists('temporary-slime')) {
      const slime = this.make.graphics({ x: 0, y: 0, add: false });
      slime.fillStyle(0x64b85d, 1);
      slime.fillRoundedRect(1, 7, 30, 23, 9);
      slime.fillStyle(0x91df79, 1);
      slime.fillCircle(11, 15, 4);
      slime.fillCircle(21, 15, 4);
      slime.fillStyle(0x17212b, 1);
      slime.fillCircle(11, 15, 2);
      slime.fillCircle(21, 15, 2);
      slime.generateTexture('temporary-slime', 32, 32);
      slime.destroy();
    }
  }

  createGroundItemTextures() {
    const definitions = [
      ['temporary-ground-wood', 0x9a6336, (graphics) => {
        graphics.fillRect(2, 7, 16, 6);
        graphics.fillStyle(0xc58a50, 1);
        graphics.fillRect(4, 5, 12, 3);
      }],
      ['temporary-ground-stone', 0x747d86, (graphics) => {
        graphics.fillRoundedRect(2, 4, 16, 13, 5);
        graphics.fillStyle(0xa8b0b7, 1);
        graphics.fillRect(6, 5, 7, 3);
      }],
      ['temporary-slime-gel', 0x63c76a, (graphics) => {
        graphics.fillRoundedRect(2, 7, 16, 11, 5);
        graphics.fillStyle(0x9be889, 1);
        graphics.fillRect(6, 6, 7, 4);
        graphics.fillStyle(0xd2ffc0, 1);
        graphics.fillRect(6, 9, 3, 3);
      }],
      ['temporary-ground-berries', 0xc53f57, (graphics) => {
        graphics.fillCircle(6, 10, 5);
        graphics.fillCircle(14, 10, 5);
        graphics.fillCircle(10, 5, 5);
        graphics.fillStyle(0x3f7d46, 1);
        graphics.fillRect(9, 0, 3, 4);
      }],
      ['temporary-stone-axe', 0x8c613c, (graphics) => {
        graphics.fillRect(9, 4, 3, 15);
        graphics.fillStyle(0x9099a1, 1);
        graphics.fillRect(5, 2, 11, 6);
        graphics.fillRect(3, 4, 4, 4);
      }],
      ['temporary-stone-pickaxe', 0x8c613c, (graphics) => {
        graphics.fillRect(9, 5, 3, 14);
        graphics.fillStyle(0x9099a1, 1);
        graphics.fillRect(3, 2, 14, 4);
        graphics.fillRect(2, 4, 4, 3);
        graphics.fillRect(15, 4, 3, 3);
      }]
    ];

    definitions.forEach(([textureKey, color, draw]) => {
      if (this.textures.exists(textureKey)) return;
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(color, 1);
      draw(graphics);
      graphics.generateTexture(textureKey, 20, 20);
      graphics.destroy();
    });
  }

  validateTreeBlockerGeometry() {
    const trees = this.worldObjects.filter((gameObject) => gameObject.getData('type') === 'TREE');

    if (this.treeBlockers.length !== trees.length) {
      throw new Error(
        `Количество блокировщиков деревьев не совпадает с количеством спрайтов `
        + `(спрайтов: ${trees.length}, блокировщиков: ${this.treeBlockers.length}).`
      );
    }

    trees.forEach((tree) => {
      const treeId = tree.getData('id');
      const blockers = this.treeBlockers.filter(
        (blocker) => blocker.getData('ownerId') === treeId
      );

      if (tree.body && tree.body.enable) {
        throw new Error(`Визуальный спрайт дерева ${treeId} не должен иметь активное физическое тело.`);
      }

      if (blockers.length !== 1) {
        throw new Error(
          `Для дерева ${treeId} ожидался один блокировщик, найдено: ${blockers.length}.`
        );
      }

      const blocker = blockers[0];
      const treeBounds = tree.getBounds();
      const body = blocker.body;
      const bodyLeft = body.position.x;
      const bodyTop = body.position.y;
      const bodyRight = bodyLeft + body.width;
      const bodyBottom = bodyTop + body.height;
      const tolerance = 1;
      const bodyDescription = `x: ${bodyLeft}, y: ${bodyTop}, width: ${body.width}, height: ${body.height}`;

      if (body.width !== 18 || body.height !== 16) {
        throw new Error(`Неверный размер блокировщика дерева ${treeId} (${bodyDescription}).`);
      }

      if (
        bodyLeft < treeBounds.left - tolerance
        || bodyRight > treeBounds.right + tolerance
      ) {
        throw new Error(`Блокировщик дерева ${treeId} вышел за горизонтальные границы (${bodyDescription}).`);
      }

      if (bodyTop < treeBounds.top + treeBounds.height * 0.75 - tolerance) {
        throw new Error(`Блокировщик дерева ${treeId} пересекает область кроны (${bodyDescription}).`);
      }

      if (bodyBottom > treeBounds.bottom + tolerance) {
        throw new Error(`Блокировщик дерева ${treeId} находится ниже изображения (${bodyDescription}).`);
      }

      if (
        Math.abs(blocker.x - treeBounds.centerX) > tolerance
        || Math.abs(blocker.y - (treeBounds.bottom - 8)) > tolerance
      ) {
        throw new Error(`Блокировщик дерева ${treeId} неверно выровнен (${bodyDescription}).`);
      }
    });
  }

  updateWorldDepth(gameObject) {
    const bottom = gameObject.y + gameObject.displayHeight * (1 - gameObject.originY);
    gameObject.setDepth(bottom * WORLD_DEPTH_SCALE);
  }

  createControls() {
    this.input.addPointer(1);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.useKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.buildToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.placeBuildKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.cancelBuildKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.saveKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.loadKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.movementVector = new Phaser.Math.Vector2();
  }

  createVirtualJoystick() {
    this.virtualJoystick = new VirtualJoystick(this);
  }

  createInteractionInterface() {
    this.interactionCleanupDone = false;
    this.actionPointerId = null;
    this.actionNativePointerId = null;
    this.holdInputSource = null;
    this.holdStartHotbarIndex = null;
    this.holdToolDisplayName = null;
    this.holdActionSystem = new HoldActionSystem();

    this.targetMarker = this.add.circle(0, 0, 18, 0xffe16a, 0.18)
      .setStrokeStyle(3, 0xfff2a8, 0.95)
      .setDepth(INTERFACE_DEPTH - 10)
      .setVisible(false);

    this.holdProgressBackground = this.add.rectangle(0, 0, 84, 14, 0x14202a, 0.9)
      .setStrokeStyle(2, 0xfff2a8, 0.9)
      .setDepth(INTERFACE_DEPTH - 9)
      .setVisible(false);
    this.holdProgressFill = this.add.rectangle(0, 0, 78, 8, 0x6fda83, 1)
      .setOrigin(0, 0.5)
      .setDepth(INTERFACE_DEPTH - 8)
      .setVisible(false);
    this.holdProgressText = this.add.text(0, 0, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(INTERFACE_DEPTH - 7).setVisible(false);

    this.actionButton = this.add.circle(0, 0, 36, 0x263642, 0.42)
      .setStrokeStyle(3, 0xb9cbd6, 0.5)
      .setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH)
      .setInteractive();

    this.actionButtonLabel = this.add.text(0, 0, 'E', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#b9cbd6'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 1);

    this.interactionResultText = this.add.text(480, 148, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#fff4b0',
      backgroundColor: '#17212bcc',
      padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH).setVisible(false);

    this.hideInteractionMessage = () => {
      this.interactionResultText.setVisible(false);
      this.interactionMessageTimer.paused = true;
    };
    this.interactionMessageTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      paused: true,
      callback: this.hideInteractionMessage
    });

    this.onActionPointerDown = (pointer) => {
      if (!this.canHarvest()) return;
      if (this.actionPointerId !== null || this.interactionSystem.getCurrentTarget() === null) return;

      this.actionPointerId = pointer.id;
      this.actionNativePointerId = pointer.event ? pointer.event.pointerId : null;
      this.actionButton.setScale(0.92);
      this.actionButtonLabel.setScale(0.92);
      if (!this.startInteractionHold('pointer')) this.resetActionButton();
    };
    this.onActionPointerEnd = (pointer) => {
      if (pointer.id === this.actionPointerId) this.releaseInteractionHold('pointer');
    };
    this.onActionPointerOut = (pointer) => {
      if (pointer.id === this.actionPointerId) this.releaseInteractionHold('pointer');
    };
    this.onActionWindowPointerEnd = (event) => {
      if (event.pointerId === this.actionNativePointerId) this.releaseInteractionHold('pointer');
    };
    this.onActionVisibilityChange = () => {
      if (document.hidden) this.cancelInteractionHold();
    };
    this.onActionBlur = () => this.cancelInteractionHold();
    this.onActionResize = () => {
      this.cancelInteractionHold();
      this.positionActionButton();
    };

    this.actionButton.on('pointerdown', this.onActionPointerDown);
    this.actionButton.on('pointerout', this.onActionPointerOut);
    this.input.on('pointerup', this.onActionPointerEnd);
    this.input.on('pointerupoutside', this.onActionPointerEnd);
    this.scale.on('resize', this.onActionResize);
    window.addEventListener('pointerup', this.onActionWindowPointerEnd);
    window.addEventListener('pointercancel', this.onActionWindowPointerEnd);
    window.addEventListener('blur', this.onActionBlur);
    document.addEventListener('visibilitychange', this.onActionVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInteractionInterface, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupInteractionInterface, this);

    this.positionActionButton();
    this.updateInteractionTarget();
  }

  positionActionButton() {
    const x = this.scale.gameSize.width - 92;
    const y = this.scale.gameSize.height - 92;
    this.actionButton.setPosition(x, y);
    this.actionButtonLabel.setPosition(x, y);
  }

  updateInteractionTarget() {
    const target = this.interactionSystem.update(
      this.player.x,
      this.player.y,
      this.interactionTargetValidator
    );
    const hasTarget = target !== null;

    if (hasTarget) {
      this.targetMarker
        .setPosition(target.interactionX, target.interactionY - 26)
        .setVisible(true);
    } else {
      this.targetMarker.setVisible(false);
    }

    this.actionButton.setFillStyle(hasTarget ? 0x3f8f5b : 0x263642, hasTarget ? 0.82 : 0.42);
    this.actionButton.setStrokeStyle(3, hasTarget ? 0xd9ffe3 : 0xb9cbd6, hasTarget ? 0.95 : 0.5);
    this.actionButtonLabel.setColor(hasTarget ? '#ffffff' : '#b9cbd6');
  }

  startInteractionHold(source) {
    if (!this.canHarvest()) return false;
    const target = this.interactionSystem.getCurrentTarget();
    if (target === null || this.holdInputSource !== null) return false;

    const configuration = this.getInteractionHoldConfiguration(target);
    const started = this.holdActionSystem.start(target, configuration.durationOverride);
    if (!started) return false;

    this.holdInputSource = source;
    this.holdStartHotbarIndex = configuration.hotbarIndex;
    this.holdToolDisplayName = configuration.toolDisplayName;
    this.updateHoldProgress(target, 0);
    return true;
  }

  getInteractionHoldConfiguration(target) {
    const hotbarIndex = this.inventoryUI.getActiveHotbarIndex();
    if (target.type === 'WOOD_WALL') {
      return {
        hotbarIndex,
        durationOverride: BUILDING_DISMANTLE_DURATION_MS,
        toolDisplayName: null
      };
    }
    const slot = this.inventoryModel.getSlot(hotbarIndex);
    const item = slot === null ? null : ItemCatalog[slot.itemType];
    const isEffectiveTool = Boolean(
      item
      && item.effectiveAgainst === target.type
      && Number.isFinite(item.actionDurationMs)
      && item.actionDurationMs > 0
    );
    return {
      hotbarIndex,
      durationOverride: isEffectiveTool ? item.actionDurationMs : undefined,
      toolDisplayName: isEffectiveTool ? item.displayName : null
    };
  }

  updateInteractionHold(delta) {
    const wasActive = this.holdActionSystem.active;
    if (wasActive
      && this.inventoryUI.getActiveHotbarIndex() !== this.holdStartHotbarIndex) {
      this.cancelInteractionHold();
      return;
    }
    const completedTarget = this.holdActionSystem.update(
      delta,
      this.interactionSystem.getCurrentTarget()
    );

    if (completedTarget !== null) {
      this.completeInteraction(completedTarget);
      this.hideHoldProgress();
      this.actionButton.setScale(1);
      this.actionButtonLabel.setScale(1);
      return;
    }

    if (wasActive && !this.holdActionSystem.active) {
      this.cancelInteractionHold();
      return;
    }

    if (this.holdActionSystem.active) {
      this.updateHoldProgress(
        this.holdActionSystem.target,
        this.holdActionSystem.getProgress()
      );
    }
  }

  updateHoldProgress(target, progress) {
    const x = target.interactionX;
    const y = target.interactionY - 50;
    const percent = Math.round(progress * 100);

    this.holdProgressBackground.setPosition(x, y).setVisible(true);
    this.holdProgressFill
      .setPosition(x - 39, y)
      .setScale(progress, 1)
      .setVisible(true);
    const toolLabel = this.holdToolDisplayName ? ` · ${this.holdToolDisplayName}` : '';
    this.holdProgressText
      .setPosition(x, y)
      .setText(`${percent}%${toolLabel}`)
      .setVisible(true);
  }

  hideHoldProgress() {
    this.holdProgressBackground.setVisible(false);
    this.holdProgressFill.setVisible(false);
    this.holdProgressText.setVisible(false);
  }

  completeInteraction(target) {
    if (target.type === 'WOOD_WALL') {
      this.completeBuildingDismantle(target);
      return;
    }

    const runtimeObject = this.runtimeWorldObjects.get(target.id);
    if (!runtimeObject || !runtimeObject.active) return;

    const position = this.worldGrid.cellToWorldCenter(runtimeObject.col, runtimeObject.row);
    if (!this.worldGrid.isInside(runtimeObject.col, runtimeObject.row)
      || !this.worldGrid.isWalkable(runtimeObject.col, runtimeObject.row)
      || position === null) {
      throw new Error(
        `Нельзя создать предмет после добычи ${runtimeObject.id} `
        + `(col: ${runtimeObject.col}, row: ${runtimeObject.row}).`
      );
    }

    runtimeObject.active = false;
    this.interactionSystem.removeTarget(runtimeObject.id);
    this.targetMarker.setVisible(false);
    this.hideHoldProgress();

    this.setRuntimeWorldObjectActive(runtimeObject, false);

    const drop = WORLD_OBJECT_DROPS[runtimeObject.type];
    this.groundItemSystem.spawn(drop.itemType, drop.quantity, position.x, position.y);
    this.showInteractionMessage(`${drop.itemType} ×${drop.quantity}`);
  }

  completeBuildingDismantle(target) {
    const building = this.buildingSystem.getPlacement(target.id);
    if (building === null) return false;
    if (target.building !== building || target.buildType !== building.buildType) {
      throw new Error(`Цель постройки ${target.id} больше не соответствует активной постройке.`);
    }

    const definition = BuildCatalog[building.buildType];
    const position = this.worldGrid.cellToWorldCenter(building.col, building.row);
    if (!definition || position === null) {
      throw new Error(
        `Нельзя разобрать постройку ${building.id} `
        + `(тип: ${building.buildType}, col: ${building.col}, row: ${building.row}).`
      );
    }
    const refunds = definition.cost.map((ingredient) => ({
      itemType: ingredient.itemType,
      quantity: Math.ceil(ingredient.quantity * 0.5)
    })).filter((refund) => refund.quantity > 0);

    const removed = this.buildingSystem.remove(building.id);
    if (removed === null) return false;
    this.refreshInteractionTargets();
    this.targetMarker.setVisible(false);
    this.hideHoldProgress();
    refunds.forEach((refund) => {
      this.groundItemSystem.spawn(
        refund.itemType,
        refund.quantity,
        position.x,
        position.y
      );
    });
    const refundText = refunds.map(
      (refund) => `${refund.itemType} ×${refund.quantity}`
    ).join(', ');
    this.showInteractionMessage(`Разобрано: ${definition.displayName}. Возврат: ${refundText}`);
    return true;
  }

  setRuntimeWorldObjectActive(runtimeObject, active) {
    runtimeObject.active = active;
    if (runtimeObject.visualObject && runtimeObject.visualObject.active) {
      runtimeObject.visualObject.setVisible(active);
    }
    if (runtimeObject.blockerObject && runtimeObject.blockerObject.body) {
      runtimeObject.blockerObject.body.enable = active;
      if (runtimeObject.blockerObject === runtimeObject.visualObject) {
        runtimeObject.blockerObject.setVisible(active);
      }
    }
  }

  restoreRemovedWorldObjects(removedIds) {
    const removed = new Set(removedIds);
    this.runtimeWorldObjects.forEach((object) => {
      this.setRuntimeWorldObjectActive(object, !removed.has(object.id));
    });
    this.refreshInteractionTargets();
  }

  showInteractionMessage(message) {
    this.interactionResultText
      .setText(message)
      .setVisible(true);

    this.interactionMessageTimer.reset({
      delay: 1000,
      loop: true,
      paused: false,
      callback: this.hideInteractionMessage
    });
  }

  cancelInteractionHold() {
    this.holdActionSystem.release();
    this.holdInputSource = null;
    this.holdStartHotbarIndex = null;
    this.holdToolDisplayName = null;
    this.hideHoldProgress();
    this.resetActionButton();
  }

  releaseInteractionHold(source) {
    if (this.holdInputSource !== source) return;

    this.holdActionSystem.release();
    this.holdInputSource = null;
    this.holdStartHotbarIndex = null;
    this.holdToolDisplayName = null;
    this.hideHoldProgress();
    this.resetActionButton();
  }

  resetActionButton() {
    this.actionPointerId = null;
    this.actionNativePointerId = null;
    if (this.actionButton) this.actionButton.setScale(1);
    if (this.actionButtonLabel) this.actionButtonLabel.setScale(1);
  }

  cleanupInteractionInterface() {
    if (this.interactionCleanupDone) return;
    this.interactionCleanupDone = true;
    this.cancelInteractionHold();
    if (this.groundItemSystem) {
      this.groundItemSystem.clear();
      this.groundItemSystem = null;
    }
    if (this.runtimeWorldObjects) this.runtimeWorldObjects.clear();
    if (this.inventoryModel) {
      this.inventoryModel.clear();
      if (this.inventoryUI && !this.inventoryUI.destroyed) this.inventoryUI.updateFromModel();
    }
    if (this.playerMapCollider) {
      this.playerMapCollider.destroy();
      this.playerMapCollider = null;
    }
    if (this.worldObjectsCollider) {
      this.worldObjectsCollider.destroy();
      this.worldObjectsCollider = null;
    }

    this.actionButton.off('pointerdown', this.onActionPointerDown);
    this.actionButton.off('pointerout', this.onActionPointerOut);
    this.input.off('pointerup', this.onActionPointerEnd);
    this.input.off('pointerupoutside', this.onActionPointerEnd);
    this.scale.off('resize', this.onActionResize);
    window.removeEventListener('pointerup', this.onActionWindowPointerEnd);
    window.removeEventListener('pointercancel', this.onActionWindowPointerEnd);
    window.removeEventListener('blur', this.onActionBlur);
    document.removeEventListener('visibilitychange', this.onActionVisibilityChange);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInteractionInterface, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupInteractionInterface, this);

    if (this.interactionMessageTimer) {
      this.interactionMessageTimer.remove(false);
      this.interactionMessageTimer = null;
    }
  }

  registerLifecycleHandlers() {
    this.lifecycleHandlersRemoved = false;
    this.pendingScaleRefresh = null;

    this.resetControls = () => {
      if (this.input.keyboard) this.input.keyboard.resetKeys();
      if (this.virtualJoystick) this.virtualJoystick.reset();
      if (this.player && this.player.body) this.player.setVelocity(0, 0);
    };

    this.refreshScaleAfterLayout = () => {
      this.resetControls();
      if (this.pendingScaleRefresh !== null) {
        window.cancelAnimationFrame(this.pendingScaleRefresh);
      }
      this.pendingScaleRefresh = window.requestAnimationFrame(() => {
        this.pendingScaleRefresh = null;
        if (this.sys.isActive()) this.scale.refresh();
      });
    };

    this.onVisibilityChange = () => {
      this.resetControls();
      if (!document.hidden) this.refreshScaleAfterLayout();
    };

    this.scale.on('resize', this.resetControls);
    window.addEventListener('blur', this.resetControls);
    window.addEventListener('focus', this.refreshScaleAfterLayout);
    window.addEventListener('orientationchange', this.refreshScaleAfterLayout);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeLifecycleHandlers, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.removeLifecycleHandlers, this);
  }

  removeLifecycleHandlers() {
    if (this.lifecycleHandlersRemoved) return;
    this.lifecycleHandlersRemoved = true;

    if (this.pendingScaleRefresh !== null) {
      window.cancelAnimationFrame(this.pendingScaleRefresh);
      this.pendingScaleRefresh = null;
    }

    this.scale.off('resize', this.resetControls);
    window.removeEventListener('blur', this.resetControls);
    window.removeEventListener('focus', this.refreshScaleAfterLayout);
    window.removeEventListener('orientationchange', this.refreshScaleAfterLayout);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.removeLifecycleHandlers, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.removeLifecycleHandlers, this);
  }

  createCamera() {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.worldGrid.worldWidth, this.worldGrid.worldHeight);
    camera.startFollow(this.player, true, 0.09, 0.09);
    camera.setRoundPixels(true);
  }

  createInterface() {
    const panel = this.add.rectangle(18, 18, 365, 96, 0x111820, 0.82)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH);
    panel.setStrokeStyle(2, 0xbad5e8, 0.5);

    this.add.text(34, 30, 'Прототип выживалки', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff'
    }).setScrollFactor(0).setDepth(INTERFACE_DEPTH);

    this.add.text(34, 61, 'Этап 1: основа', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#bde6ff'
    }).setScrollFactor(0).setDepth(INTERFACE_DEPTH);

    this.add.text(34, 88, 'Управление: WASD, стрелки или джойстик', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#e7edf2'
    }).setScrollFactor(0).setDepth(INTERFACE_DEPTH);

    this.inventoryHudText = this.add.text(34, 122, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#fff4b0',
      backgroundColor: '#111820d9',
      padding: { x: 10, y: 6 }
    }).setScrollFactor(0).setDepth(INTERFACE_DEPTH);
    this.updateInventoryHud();
  }

  createInventoryUI() {
    this.inventoryUI = new InventoryUI(
      this,
      this.inventoryModel,
      {
        WOOD: 'temporary-ground-wood',
        STONE: 'temporary-ground-stone',
        SLIME_GEL: 'temporary-slime-gel',
        BERRIES: 'temporary-ground-berries',
        STONE_AXE: 'temporary-stone-axe',
        STONE_PICKAXE: 'temporary-stone-pickaxe'
      },
      (isOpen) => this.handleInventoryOpenChanged(isOpen),
      () => this.canOpenPanel(),
      () => this.canSelectHotbarSlot()
    );
  }

  createCraftingUI() {
    this.craftingUI = new CraftingUI(
      this,
      this.craftingModel,
      (isOpen) => this.handleCraftingOpenChanged(isOpen),
      (result, recipe) => this.handleCraftResult(result, recipe),
      () => this.canOpenPanel()
    );
  }

  isBlockingPanelOpen() {
    return this.isModalOpen();
  }

  handleCraftResult(result, recipe) {
    if (result.success) {
      this.inventoryUI.updateFromModel();
      this.updateInventoryHud();
      this.showInteractionMessage(`Создано: ${recipe.displayName}`);
    } else if (result.reason === 'missingIngredients') {
      this.showInteractionMessage('Недостаточно ресурсов');
    } else if (result.reason === 'noSpace') {
      this.showInteractionMessage('Нет места в инвентаре');
    }
  }

  createSurvivalInterface() {
    this.survivalCleanupDone = false;
    this.usePointerId = null;
    this.useNativePointerId = null;
    this.statusHUD = new StatusHUD(this);
    this.statusHUD.update(this.playerStatsModel.getHealth(), this.playerStatsModel.getHunger());

    this.useButton = this.add.circle(0, 0, 30, 0x36516a, 0.88)
      .setStrokeStyle(3, 0xc8e8ff, 0.85)
      .setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 10)
      .setInteractive();
    this.useButtonLabel = this.add.text(0, 0, 'USE', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 11);
    this.deathText = this.add.text(480, 270, 'Вы погибли', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ff9b9b',
      backgroundColor: '#111820e6',
      padding: { x: 24, y: 14 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 50).setVisible(false);

    this.onUsePointerDown = (pointer, localX, localY, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (this.usePointerId !== null || !this.canUseFood()) return;
      this.usePointerId = pointer.id;
      this.useNativePointerId = pointer.event ? pointer.event.pointerId : null;
      this.useButton.setScale(0.92);
      this.useButtonLabel.setScale(0.92);
      this.tryUseActiveItem();
    };
    this.onUsePointerEnd = (pointer) => {
      if (pointer.id === this.usePointerId) this.resetUseButton();
    };
    this.onUseWindowPointerEnd = (event) => {
      if (event.pointerId === this.useNativePointerId) this.resetUseButton();
    };
    this.onUseBlur = () => this.resetUseButton();
    this.onUseVisibilityChange = () => {
      if (document.hidden) this.resetUseButton();
    };
    this.onUseResize = () => {
      this.resetUseButton();
      this.positionUseButton();
    };

    this.useButton.on('pointerdown', this.onUsePointerDown);
    this.input.on('pointerup', this.onUsePointerEnd);
    this.input.on('pointerupoutside', this.onUsePointerEnd);
    this.scale.on('resize', this.onUseResize);
    window.addEventListener('pointerup', this.onUseWindowPointerEnd);
    window.addEventListener('pointercancel', this.onUseWindowPointerEnd);
    window.addEventListener('blur', this.onUseBlur);
    document.addEventListener('visibilitychange', this.onUseVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSurvivalInterface, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupSurvivalInterface, this);
    this.positionUseButton();
  }

  createSaveState() {
    const stats = this.playerStatsModel.exportState();
    return { version: 1, savedAt: Date.now(), player: { x: this.player.x, y: this.player.y, ...stats },
      inventory: { activeHotbarIndex: this.inventoryUI.getActiveHotbarIndex(), slots: this.inventoryModel.exportState() },
      world: {
        removedObjectIds: Array.from(this.runtimeWorldObjects.values()).filter((o) => !o.active).map((o) => o.id),
        groundItems: this.groundItemSystem.exportState(), walls: this.buildingSystem.exportState(),
        deadCreatureIds: this.creatureSystem.exportState()
      } };
  }

  prepareForSaveOperation() {
    this.cancelInteractionHold(); this.exitBuildMode();
    if (this.inventoryUI.isOpen) this.inventoryUI.closePanel();
    if (this.craftingUI.isOpen) this.craftingUI.closePanel();
    this.inventoryUI.resetBackpackPointer(); this.craftingUI.resetPointer();
    if (this.virtualJoystick) this.virtualJoystick.reset();
    if (this.input.keyboard) this.input.keyboard.resetKeys();
    this.resetBuildTogglePointer(); this.resetPlacePointer();
    this.player.setVelocity(0, 0); this.resetAttackButton(); this.resetUseButton();
  }

  saveGame() {
    if (!this.canSave()) {
      if (this.isPlayerDead()) this.showInteractionMessage('Нельзя сохраняться после смерти');
      return false;
    }
    this.prepareForSaveOperation();
    const result = this.saveSystem.save(this.createSaveState());
    this.showInteractionMessage(result.success ? 'Игра сохранена' : 'Ошибка локального хранилища');
    return result.success;
  }

  isSavedPositionValid(x, y) {
    const cell = this.worldGrid.worldToCell(x, y);
    if (!cell || !this.worldGrid.isWalkable(cell.col, cell.row)) return false;
    const halfWidth = this.player.body.width / 2;
    const halfHeight = this.player.body.height / 2;
    const left = x - halfWidth;
    const right = x + halfWidth;
    const top = y - halfHeight;
    const bottom = y + halfHeight;
    const topLeftCell = this.worldGrid.worldToCell(left + 0.001, top + 0.001);
    const bottomRightCell = this.worldGrid.worldToCell(right - 0.001, bottom - 0.001);
    if (!topLeftCell || !bottomRightCell) return false;
    for (let row = topLeftCell.row; row <= bottomRightCell.row; row += 1) {
      for (let col = topLeftCell.col; col <= bottomRightCell.col; col += 1) {
        if (!this.worldGrid.isWalkable(col, row)) return false;
      }
    }
    return !this.blockingWorldObjects.getChildren().some((blocker) => {
      const body = blocker && blocker.body;
      return blocker.active && body && body.enable
        && left < body.right && right > body.left
        && top < body.bottom && bottom > body.top;
    });
  }

  findSafePlayerPosition(x, y) {
    if (this.isSavedPositionValid(x, y)) return { x, y };
    const start = FixedMapData.playerStart;
    const cells = [];
    for (let row = 0; row < this.worldGrid.rows; row += 1) for (let col = 0; col < this.worldGrid.columns; col += 1) {
      cells.push({ col, row, distance: Math.abs(col - start.col) + Math.abs(row - start.row) });
    }
    cells.sort((a, b) => a.distance - b.distance || a.row - b.row || a.col - b.col);
    for (const cell of cells) {
      const p = this.worldGrid.cellToWorldCenter(cell.col, cell.row);
      if (this.isSavedPositionValid(p.x, p.y)) return p;
    }
    throw new Error('Не найдена допустимая позиция игрока.');
  }

  applySaveState(state) {
    if (!this.inventoryModel.importState(state.inventory.slots)
      || !this.playerStatsModel.importState(state.player)) throw new Error('Ошибка импорта сохранения.');
    this.restoreRemovedWorldObjects(state.world.removedObjectIds);
    if (!this.groundItemSystem.restoreState(state.world.groundItems)
      || !this.buildingSystem.restoreState(state.world.walls)
      || !this.creatureSystem.restoreState(state.world.deadCreatureIds)) throw new Error('Ошибка импорта сохранения.');
    this.refreshInteractionTargets();
    const position = this.findSafePlayerPosition(state.player.x, state.player.y);
    this.player.setVisible(true);
    this.player.body.enable = true;
    this.player.setPosition(position.x, position.y); this.player.body.reset(position.x, position.y);
    this.resetPlayerCombatState();
    this.creatureSystem.resetTransientState();
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.inventoryUI.setActiveQuickSlot(state.inventory.activeHotbarIndex);
    this.isDeathHandled = this.playerStatsModel.isDead();
    this.lastPlayerAttackTime = -Infinity;
    this.updateDeathPresentation();
    this.inventoryUI.updateFromModel(); this.updateInventoryHud();
    this.statusHUD.update(this.playerStatsModel.getHealth(), this.playerStatsModel.getHunger());
  }

  loadGame() {
    if (!this.canLoad()) return false;
    const loaded = this.saveSystem.load();
    if (!loaded.success) {
      const messages = { notFound: 'Сохранение не найдено', invalidData: 'Сохранение повреждено', storageError: 'Ошибка локального хранилища' };
      this.showInteractionMessage(messages[loaded.reason]); return false;
    }
    const rollback = this.createSaveState(); this.isApplyingSave = true;
    try { this.prepareForSaveOperation(); this.applySaveState(loaded.state); this.showInteractionMessage('Игра загружена'); return true; }
    catch { try { this.applySaveState(rollback); } catch {} this.showInteractionMessage('Сохранение повреждено'); return false; }
    finally { this.isApplyingSave = false; }
  }

  createSaveInterface() {
    this.savePointers = { save: null, load: null }; this.saveNativePointers = { save: null, load: null };
    const make = (label, x, y) => ({ button: this.add.circle(x, y, 25, 0x35536b, 0.9).setStrokeStyle(2, 0xcbe9ff, .8).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 12).setInteractive(),
      text: this.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#fff' }).setOrigin(.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 13) });
    this.saveControl = make('SAVE', 450, 42); this.loadControl = make('LOAD', 520, 42);
    const bind = (name, control, action) => { control.handler = (pointer, lx, ly, event) => { if (event?.stopPropagation) event.stopPropagation(); if (this.savePointers[name] !== null || this.isApplyingSave) return; this.savePointers[name] = pointer.id; this.saveNativePointers[name] = pointer.event?.pointerId ?? null; action.call(this); }; control.button.on('pointerdown', control.handler); };
    bind('save', this.saveControl, this.saveGame); bind('load', this.loadControl, this.loadGame);
    this.onSavePointerUp = (pointer) => { for (const n of ['save','load']) if (this.savePointers[n] === pointer.id) this.savePointers[n] = this.saveNativePointers[n] = null; };
    this.onSaveWindowUp = (event) => { for (const n of ['save','load']) if (this.saveNativePointers[n] === event.pointerId) this.savePointers[n] = this.saveNativePointers[n] = null; };
    this.onSaveBlur = () => { this.savePointers.save = this.savePointers.load = this.saveNativePointers.save = this.saveNativePointers.load = null; };
    this.onSaveVisibility = () => { if (document.hidden) this.onSaveBlur(); };
    this.input.on('pointerup', this.onSavePointerUp); this.input.on('pointerupoutside', this.onSavePointerUp); window.addEventListener('pointerup', this.onSaveWindowUp); window.addEventListener('pointercancel', this.onSaveWindowUp); window.addEventListener('blur', this.onSaveBlur); document.addEventListener('visibilitychange', this.onSaveVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSaveInterface, this); this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupSaveInterface, this);
  }

  cleanupSaveInterface() {
    if (!this.saveControl) return; this.isApplyingSave = false;
    this.saveControl.button.off('pointerdown', this.saveControl.handler); this.loadControl.button.off('pointerdown', this.loadControl.handler);
    this.input.off('pointerup', this.onSavePointerUp); this.input.off('pointerupoutside', this.onSavePointerUp); window.removeEventListener('pointerup', this.onSaveWindowUp); window.removeEventListener('pointercancel', this.onSaveWindowUp); window.removeEventListener('blur', this.onSaveBlur); document.removeEventListener('visibilitychange', this.onSaveVisibility);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSaveInterface, this); this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupSaveInterface, this);
    [this.saveControl.button,this.saveControl.text,this.loadControl.button,this.loadControl.text].forEach((o)=>{if(o.active)o.destroy();}); this.saveControl = this.loadControl = null;
  }

  createCombatInterface() {
    this.combatCleanupDone = false;
    this.lastPlayerAttackTime = -Infinity;
    this.resetPlayerCombatState();
    this.attackPointerId = null;
    this.attackNativePointerId = null;
    this.attackButton = this.add.circle(0, 0, 30, 0x8b3f47, 0.9)
      .setStrokeStyle(3, 0xffc4c8, 0.9).setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 12).setInteractive();
    this.attackButtonLabel = this.add.text(0, 0, 'ATTACK', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 13);
    this.attackButton.setPosition(this.scale.gameSize.width - 328, this.scale.gameSize.height - 92);
    this.attackButtonLabel.setPosition(this.scale.gameSize.width - 328, this.scale.gameSize.height - 92);
    this.onAttackPointerDown = (pointer, localX, localY, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (this.attackPointerId !== null || !this.canAttack()) return;
      this.attackPointerId = pointer.id;
      this.attackNativePointerId = pointer.event ? pointer.event.pointerId : null;
      this.attackButton.setScale(0.92);
      this.attackButtonLabel.setScale(0.92);
      this.tryPlayerAttack();
    };
    this.onAttackPointerEnd = (pointer) => {
      if (pointer.id === this.attackPointerId) this.resetAttackButton();
    };
    this.onAttackWindowEnd = (event) => {
      if (event.pointerId === this.attackNativePointerId) this.resetAttackButton();
    };
    this.onAttackBlur = () => this.resetAttackButton();
    this.onAttackVisibility = () => { if (document.hidden) this.resetAttackButton(); };
    this.onAttackResize = () => {
      this.resetAttackButton();
      this.attackButton.setPosition(this.scale.gameSize.width - 328, this.scale.gameSize.height - 92);
      this.attackButtonLabel.setPosition(this.scale.gameSize.width - 328, this.scale.gameSize.height - 92);
    };
    this.attackButton.on('pointerdown', this.onAttackPointerDown);
    this.input.on('pointerup', this.onAttackPointerEnd);
    this.input.on('pointerupoutside', this.onAttackPointerEnd);
    this.scale.on('resize', this.onAttackResize);
    window.addEventListener('pointerup', this.onAttackWindowEnd);
    window.addEventListener('pointercancel', this.onAttackWindowEnd);
    window.addEventListener('blur', this.onAttackBlur);
    document.addEventListener('visibilitychange', this.onAttackVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupCombatInterface, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupCombatInterface, this);
  }

  resetAttackButton() {
    this.attackPointerId = null;
    this.attackNativePointerId = null;
    if (this.attackButton && this.attackButton.active) this.attackButton.setScale(1);
    if (this.attackButtonLabel && this.attackButtonLabel.active) this.attackButtonLabel.setScale(1);
  }

  getCombatTime() {
    return this.time && Number.isFinite(this.time.now) ? this.time.now : 0;
  }

  resetPlayerCombatState() {
    this.invulnerableUntil = 0;
    this.playerHitFlashUntil = 0;
    if (this.player && this.player.active) {
      this.player.clearTint();
      if (this.player.body) this.player.body.setVelocity(0, 0);
    }
  }

  handleCreatureContactAttack(attack) {
    const time = this.getCombatTime();
    if (!attack || this.isPlayerDead() || time < this.invulnerableUntil) return false;
    const damage = this.playerStatsModel.takeDamage(attack.damage);
    if (damage <= 0) return false;
    this.invulnerableUntil = time + CombatConfig.PLAYER.invulnerabilityMs;
    this.playerHitFlashUntil = time + CombatConfig.PLAYER.flashMs;
    this.player.setTint(0xffb5b5);
    return true;
  }

  updatePlayerHitFlash() {
    const time = this.getCombatTime();
    if (!this.player || !this.player.active) return;
    if (time < this.playerHitFlashUntil) this.player.setTint(0xffb5b5);
    else this.player.clearTint();
  }

  tryPlayerAttack() {
    const time = this.getCombatTime();
    if (!this.canAttack() || time - this.lastPlayerAttackTime < PLAYER_MELEE_ATTACK.cooldownMs) {
      return false;
    }
    this.lastPlayerAttackTime = time;
    const target = this.creatureSystem.getNearestAttackable(
      this.player.x, this.player.y, PLAYER_MELEE_ATTACK.radius
    );
    if (!target) return true;
    const deathX = target.sprite.x;
    const deathY = target.sprite.y;
    const creatureDefinition = CreatureCatalog[target.type];
    const loot = creatureDefinition ? creatureDefinition.loot : null;
    const result = this.creatureSystem.damage(target.id, PLAYER_MELEE_ATTACK.damage);
    if (result.damage > 0) {
      const displayName = creatureDefinition.displayName;
      if (result.died) {
        if (!loot || !ItemCatalog[loot.itemId]
          || !Number.isInteger(loot.minQuantity) || !Number.isInteger(loot.maxQuantity)
          || loot.minQuantity <= 0 || loot.maxQuantity < loot.minQuantity) {
          throw new Error(`Некорректная конфигурация лута существа: ${target.type}.`);
        }
        const quantity = Phaser.Math.Between(loot.minQuantity, loot.maxQuantity);
        const groundItemsBefore = this.groundItemSystem.getItems().length;
        const droppedItem = this.groundItemSystem.spawn(
          loot.itemId,
          quantity,
          deathX,
          deathY
        );
        const groundItemsAfter = this.groundItemSystem.getItems();
        const textureKey = this.groundItemSystem.textureKeys[loot.itemId];
        const dropIsValid = groundItemsAfter.length === groundItemsBefore + 1
          && groundItemsAfter.includes(droppedItem)
          && droppedItem.itemType === loot.itemId
          && droppedItem.quantity === quantity
          && droppedItem.x === deathX
          && droppedItem.y === deathY
          && droppedItem.visualObject
          && droppedItem.visualObject.active
          && droppedItem.visualObject.visible
          && droppedItem.visualObject.alpha > 0
          && droppedItem.visualObject.texture.key === textureKey
          && this.textures.exists(textureKey);
        if (!dropIsValid) {
          throw new Error(
            `Не удалось создать лут ${loot.itemId} ×${quantity} в (${deathX}, ${deathY}).`
          );
        }
      }
      const message = result.died
        ? `${displayName} побеждён`
        : `Удар: ${displayName} -${result.damage}. Осталось ${result.health} HP`;
      this.showInteractionMessage(message);
    }
    return true;
  }

  cleanupCombatInterface() {
    if (this.combatCleanupDone) return;
    this.combatCleanupDone = true;
    this.resetAttackButton();
    this.resetPlayerCombatState();
    this.attackButton.off('pointerdown', this.onAttackPointerDown);
    this.input.off('pointerup', this.onAttackPointerEnd);
    this.input.off('pointerupoutside', this.onAttackPointerEnd);
    this.scale.off('resize', this.onAttackResize);
    window.removeEventListener('pointerup', this.onAttackWindowEnd);
    window.removeEventListener('pointercancel', this.onAttackWindowEnd);
    window.removeEventListener('blur', this.onAttackBlur);
    document.removeEventListener('visibilitychange', this.onAttackVisibility);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupCombatInterface, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupCombatInterface, this);
    if (this.creatureMapCollider) this.creatureMapCollider.destroy();
    if (this.creatureObstacleCollider) this.creatureObstacleCollider.destroy();
    if (this.creatureSystem) this.creatureSystem.clear();
    this.creatureMapCollider = null;
    this.creatureObstacleCollider = null;
    this.creatureSystem = null;
    if (this.attackButton && this.attackButton.active) this.attackButton.destroy();
    if (this.attackButtonLabel && this.attackButtonLabel.active) this.attackButtonLabel.destroy();
    this.attackButton = null;
    this.attackButtonLabel = null;
  }

  createBuildingInterface() {
    this.buildingCleanupDone = false;
    this.buildTogglePointerId = null;
    this.buildToggleNativePointerId = null;
    this.placePointerId = null;
    this.placeNativePointerId = null;

    this.buildToggleButton = this.add.circle(0, 0, 28, 0x806039, 0.9)
      .setStrokeStyle(2, 0xf1d2a5, 0.85).setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 12).setInteractive();
    this.buildToggleLabel = this.add.text(0, 0, 'BUILD', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 13);
    this.placeButton = this.add.circle(0, 0, 30, 0x3f8f5b, 0.9)
      .setStrokeStyle(3, 0xd9ffe3, 0.9).setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 12).setInteractive().setVisible(false);
    this.placeButton.disableInteractive();
    this.placeButtonLabel = this.add.text(0, 0, 'PLACE', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 13).setVisible(false);

    this.onBuildTogglePointerDown = (pointer, localX, localY, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (this.buildTogglePointerId !== null || !this.canBuild()) return;
      this.buildTogglePointerId = pointer.id;
      this.buildToggleNativePointerId = pointer.event ? pointer.event.pointerId : null;
      this.buildToggleButton.setScale(0.92);
      this.buildToggleLabel.setScale(0.92);
      this.toggleBuildMode();
    };
    this.onPlacePointerDown = (pointer, localX, localY, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (this.placePointerId !== null || !this.canBuild() || !this.buildingSystem.isActive()) return;
      this.placePointerId = pointer.id;
      this.placeNativePointerId = pointer.event ? pointer.event.pointerId : null;
      this.placeButton.setScale(0.92);
      this.placeButtonLabel.setScale(0.92);
      this.tryPlaceBuilding();
    };
    this.onBuildingPointerEnd = (pointer) => {
      if (pointer.id === this.buildTogglePointerId) this.resetBuildTogglePointer();
      if (pointer.id === this.placePointerId) this.resetPlacePointer();
    };
    this.onBuildingWindowPointerEnd = (event) => {
      if (event.pointerId === this.buildToggleNativePointerId) this.resetBuildTogglePointer();
      if (event.pointerId === this.placeNativePointerId) this.resetPlacePointer();
    };
    this.onBuildingBlur = () => {
      this.resetBuildTogglePointer();
      this.resetPlacePointer();
    };
    this.onBuildingVisibilityChange = () => {
      if (document.hidden) this.onBuildingBlur();
    };
    this.onBuildingResize = () => {
      this.onBuildingBlur();
      this.positionBuildingButtons();
    };

    this.buildToggleButton.on('pointerdown', this.onBuildTogglePointerDown);
    this.placeButton.on('pointerdown', this.onPlacePointerDown);
    this.input.on('pointerup', this.onBuildingPointerEnd);
    this.input.on('pointerupoutside', this.onBuildingPointerEnd);
    this.scale.on('resize', this.onBuildingResize);
    window.addEventListener('pointerup', this.onBuildingWindowPointerEnd);
    window.addEventListener('pointercancel', this.onBuildingWindowPointerEnd);
    window.addEventListener('blur', this.onBuildingBlur);
    document.addEventListener('visibilitychange', this.onBuildingVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBuildingInterface, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupBuildingInterface, this);
    this.positionBuildingButtons();
  }

  positionBuildingButtons() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    this.buildToggleButton.setPosition(width - 52, 192);
    this.buildToggleLabel.setPosition(width - 52, 192);
    this.placeButton.setPosition(width - 260, height - 92);
    this.placeButtonLabel.setPosition(width - 260, height - 92);
  }

  resetBuildTogglePointer() {
    this.buildTogglePointerId = null;
    this.buildToggleNativePointerId = null;
    if (this.buildToggleButton && this.buildToggleButton.active) this.buildToggleButton.setScale(1);
    if (this.buildToggleLabel && this.buildToggleLabel.active) this.buildToggleLabel.setScale(1);
  }

  resetPlacePointer() {
    this.placePointerId = null;
    this.placeNativePointerId = null;
    if (this.placeButton && this.placeButton.active) this.placeButton.setScale(1);
    if (this.placeButtonLabel && this.placeButtonLabel.active) this.placeButtonLabel.setScale(1);
  }

  toggleBuildMode() {
    if (this.buildingSystem.isActive()) this.exitBuildMode();
    else this.enterBuildMode();
  }

  enterBuildMode() {
    if (!this.canBuild()) return false;
    if (this.inventoryUI.isOpen) this.inventoryUI.closePanel();
    if (this.craftingUI.isOpen) this.craftingUI.closePanel();
    this.cancelInteractionHold();
    this.resetActionButton();
    this.resetUseButton();
    this.resetAttackButton();
    this.targetMarker.setVisible(false);
    this.buildingSystem.enterMode('WOOD_WALL');
    this.placeButton.setVisible(true);
    this.placeButton.setInteractive();
    this.placeButtonLabel.setVisible(true);
    this.updateBuildingPreview();
    return true;
  }

  exitBuildMode() {
    if (!this.buildingSystem || !this.buildingSystem.isActive()) return;
    this.buildingSystem.exitMode();
    this.currentBuildTarget = null;
    this.placeButton.setVisible(false);
    this.placeButton.disableInteractive();
    this.placeButtonLabel.setVisible(false);
    this.resetPlacePointer();
    if (!this.buildingCleanupDone && this.canHarvest()) this.updateInteractionTarget();
  }

  getBuildTargetCell() {
    const playerCell = this.worldGrid.worldToCell(this.player.x, this.player.y);
    if (playerCell === null) return null;
    const offsets = {
      up: { col: 0, row: -1 },
      down: { col: 0, row: 1 },
      left: { col: -1, row: 0 },
      right: { col: 1, row: 0 }
    };
    const offset = offsets[this.lastFacingDirection];
    return {
      col: playerCell.col + offset.col,
      row: playerCell.row + offset.row,
      playerCol: playerCell.col,
      playerRow: playerCell.row
    };
  }

  validateBuildCell(target) {
    const definition = BuildCatalog.WOOD_WALL;
    if (!target || !this.worldGrid.isInside(target.col, target.row)
      || !this.worldGrid.isWalkable(target.col, target.row)
      || this.worldGrid.getTileType(target.col, target.row) === 'W'
      || (target.col === target.playerCol && target.row === target.playerRow)) {
      return { valid: false, reason: 'invalidCell' };
    }
    const occupiedByWorldObject = Array.from(this.runtimeWorldObjects.values()).some(
      (object) => object.active && object.col === target.col && object.row === target.row
    );
    if (occupiedByWorldObject || this.buildingSystem.isOccupied(target.col, target.row)) {
      return { valid: false, reason: 'invalidCell' };
    }
    const occupiedByGroundItem = this.groundItemSystem.getItems().some((item) => {
      const cell = this.worldGrid.worldToCell(item.x, item.y);
      return cell !== null && cell.col === target.col && cell.row === target.row;
    });
    if (occupiedByGroundItem) return { valid: false, reason: 'invalidCell' };
    const hasCost = definition.cost.every(
      (cost) => this.inventoryModel.getTotal(cost.itemType) >= cost.quantity
    );
    return hasCost
      ? { valid: true, reason: null }
      : { valid: false, reason: 'missingResources' };
  }

  updateBuildingPreview() {
    if (!this.buildingSystem.isActive()) return;
    const target = this.getBuildTargetCell();
    const validation = this.validateBuildCell(target);
    this.currentBuildTarget = target;
    this.buildingSystem.updatePreview(target ? target.col : null, target ? target.row : null, validation.valid);
  }

  tryPlaceBuilding() {
    if (!this.canBuild() || !this.buildingSystem.isActive()) return false;
    const target = this.getBuildTargetCell();
    const validation = this.validateBuildCell(target);
    if (!validation.valid) {
      this.showInteractionMessage(
        validation.reason === 'missingResources' ? 'Недостаточно дерева' : 'Здесь нельзя строить'
      );
      return false;
    }
    const cost = BuildCatalog.WOOD_WALL.cost[0];
    if (!this.inventoryModel.consumeItem(cost.itemType, cost.quantity)) {
      this.showInteractionMessage('Недостаточно дерева');
      return false;
    }
    const placement = this.buildingSystem.place(target.col, target.row);
    if (placement === null) throw new Error(`Не удалось разместить стену (${target.col}, ${target.row}).`);
    this.refreshInteractionTargets();
    this.inventoryUI.updateFromModel();
    this.updateInventoryHud();
    this.showInteractionMessage('Построено: Деревянная стена');
    this.updateBuildingPreview();
    return true;
  }

  cleanupBuildingInterface() {
    if (this.buildingCleanupDone) return;
    this.buildingCleanupDone = true;
    this.exitBuildMode();
    this.resetBuildTogglePointer();
    this.resetPlacePointer();
    this.buildToggleButton.off('pointerdown', this.onBuildTogglePointerDown);
    this.placeButton.off('pointerdown', this.onPlacePointerDown);
    this.input.off('pointerup', this.onBuildingPointerEnd);
    this.input.off('pointerupoutside', this.onBuildingPointerEnd);
    this.scale.off('resize', this.onBuildingResize);
    window.removeEventListener('pointerup', this.onBuildingWindowPointerEnd);
    window.removeEventListener('pointercancel', this.onBuildingWindowPointerEnd);
    window.removeEventListener('blur', this.onBuildingBlur);
    document.removeEventListener('visibilitychange', this.onBuildingVisibilityChange);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBuildingInterface, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupBuildingInterface, this);
    if (this.buildingSystem) {
      this.buildingSystem.clear();
      this.buildingSystem = null;
    }
    [this.buildToggleButton, this.buildToggleLabel, this.placeButton, this.placeButtonLabel]
      .forEach((element) => {
        if (element && element.active) element.destroy();
      });
    this.buildToggleButton = null;
    this.buildToggleLabel = null;
    this.placeButton = null;
    this.placeButtonLabel = null;
  }

  positionUseButton() {
    const x = this.scale.gameSize.width - 176;
    const y = this.scale.gameSize.height - 92;
    this.useButton.setPosition(x, y);
    this.useButtonLabel.setPosition(x, y);
  }

  resetUseButton() {
    this.usePointerId = null;
    this.useNativePointerId = null;
    if (this.useButton && this.useButton.active) this.useButton.setScale(1);
    if (this.useButtonLabel && this.useButtonLabel.active) this.useButtonLabel.setScale(1);
  }

  tryUseActiveItem() {
    if (!this.canUseFood()) return false;
    const slotIndex = this.inventoryUI.getActiveHotbarIndex();
    const slot = this.inventoryModel.getSlot(slotIndex);
    if (slot === null) {
      this.showInteractionMessage('Слот пуст');
      return false;
    }

    const item = ItemCatalog[slot.itemType];
    if (!item || !item.consumable) {
      this.showInteractionMessage('Этот предмет нельзя использовать');
      return false;
    }

    const restored = this.playerStatsModel.restoreHunger(item.hungerRestore);
    if (restored === 0) {
      this.showInteractionMessage('Сытость уже полная');
      return false;
    }

    const removed = this.inventoryModel.removeFromSlot(slotIndex, 1);
    if (removed !== 1) {
      throw new Error(`Не удалось удалить использованный предмет из слота ${slotIndex}.`);
    }
    this.inventoryUI.updateFromModel();
    this.updateInventoryHud();
    this.statusHUD.update(this.playerStatsModel.getHealth(), this.playerStatsModel.getHunger());
    this.showInteractionMessage(`Съедено: ${item.displayName} +${restored}`);
    return true;
  }

  handlePlayerDeath() {
    if (this.isDeathHandled) return false;
    this.isDeathHandled = true;
    this.resetPlayerCombatState();
    this.cancelInteractionHold();
    if (this.virtualJoystick) this.virtualJoystick.reset();
    this.resetActionButton();
    this.resetUseButton();
    this.exitBuildMode();
    if (this.inventoryUI && this.inventoryUI.isOpen) this.inventoryUI.closePanel();
    if (this.craftingUI && this.craftingUI.isOpen) this.craftingUI.closePanel();
    this.targetMarker.setVisible(false);
    this.updateDeathPresentation();
    return true;
  }

  updateDeathPresentation() {
    const isDead = this.isPlayerDead();
    if (this.deathText) this.deathText.setVisible(isDead);
    if (this.useButton) {
      this.useButton.setFillStyle(isDead ? 0x303840 : 0x36516a, isDead ? 0.55 : 0.88);
      this.useButton.setStrokeStyle(3, isDead ? 0x77838c : 0xc8e8ff, isDead ? 0.5 : 0.85);
    }
  }

  cleanupSurvivalInterface() {
    if (this.survivalCleanupDone) return;
    this.survivalCleanupDone = true;
    this.resetUseButton();
    this.useButton.off('pointerdown', this.onUsePointerDown);
    this.input.off('pointerup', this.onUsePointerEnd);
    this.input.off('pointerupoutside', this.onUsePointerEnd);
    this.scale.off('resize', this.onUseResize);
    window.removeEventListener('pointerup', this.onUseWindowPointerEnd);
    window.removeEventListener('pointercancel', this.onUseWindowPointerEnd);
    window.removeEventListener('blur', this.onUseBlur);
    document.removeEventListener('visibilitychange', this.onUseVisibilityChange);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSurvivalInterface, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupSurvivalInterface, this);
    if (this.statusHUD) {
      this.statusHUD.destroy();
      this.statusHUD = null;
    }
    if (this.useButton && this.useButton.active) this.useButton.destroy();
    if (this.useButtonLabel && this.useButtonLabel.active) this.useButtonLabel.destroy();
    if (this.deathText && this.deathText.active) this.deathText.destroy();
    this.useButton = null;
    this.useButtonLabel = null;
    this.deathText = null;
    this.playerStatsModel = null;
  }

  handleInventoryOpenChanged(isOpen) {
    if (isOpen && this.isDeathHandled) {
      this.inventoryUI.closePanel();
      return;
    }
    if (isOpen && this.buildingSystem && this.buildingSystem.isActive()) {
      this.inventoryUI.closePanel();
      return;
    }
    if (isOpen && this.craftingUI && this.craftingUI.isOpen) this.craftingUI.closePanel();
    this.handleBlockingPanelChanged(isOpen);
  }

  handleCraftingOpenChanged(isOpen) {
    if (isOpen && this.isDeathHandled) {
      this.craftingUI.closePanel();
      return;
    }
    if (isOpen && this.buildingSystem && this.buildingSystem.isActive()) {
      this.craftingUI.closePanel();
      return;
    }
    if (isOpen && this.inventoryUI && this.inventoryUI.isOpen) this.inventoryUI.closePanel();
    this.handleBlockingPanelChanged(isOpen);
  }

  handleBlockingPanelChanged(isOpen) {
    this.cancelInteractionHold();
    if (this.virtualJoystick) this.virtualJoystick.reset();
    this.resetActionButton();
    if (this.input.keyboard) this.input.keyboard.resetKeys();
    if (this.player && this.player.body) this.player.setVelocity(0, 0);
    this.resetUseButton();
    this.resetAttackButton();
    if (isOpen) this.targetMarker.setVisible(false);
    if (!isOpen && this.canHarvest()) {
      this.updateInteractionTarget();
    }
  }

  updateInventoryHud() {
    this.inventoryHudText.setText(
      `WOOD: ${this.inventoryModel.getTotal('WOOD')}  `
      + `STONE: ${this.inventoryModel.getTotal('STONE')}  `
      + `BERRIES: ${this.inventoryModel.getTotal('BERRIES')}`
    );
  }

  collectNearbyGroundItems() {
    const radiusSquared = GROUND_ITEM_PICKUP_RADIUS * GROUND_ITEM_PICKUP_RADIUS;
    const nearbyItems = this.groundItemSystem.getItems().filter((item) => {
      const offsetX = item.x - this.player.x;
      const offsetY = item.y - this.player.y;
      return offsetX * offsetX + offsetY * offsetY <= radiusSquared;
    });

    nearbyItems.forEach((item) => {
      if (!item.active) return;
      const originalQuantity = item.quantity;
      const remainder = this.inventoryModel.addItem(item.itemType, originalQuantity);
      const pickedUp = originalQuantity - remainder;
      if (pickedUp === 0) return;

      if (remainder === 0) {
        this.groundItemSystem.remove(item.id);
      } else {
        this.groundItemSystem.updateQuantity(item.id, remainder);
      }
      this.updateInventoryHud();
      this.inventoryUI.updateFromModel();
      this.showInteractionMessage(`Подобрано: ${item.itemType} ×${pickedUp}`);
    });
  }

  update(time, delta) {
    if (this.survivalCleanupDone || !this.playerStatsModel) return;
    if (this.isApplyingSave) return;
    const statsDelta = Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), 250);
    this.playerStatsModel.update(statsDelta);
    this.statusHUD.update(
      this.playerStatsModel.getHealth(),
      this.playerStatsModel.getHunger()
    );
    const contactAttack = this.creatureSystem.update(
      statsDelta,
      this.player,
      this.playerStatsModel.isDead()
    );
    this.handleCreatureContactAttack(contactAttack);
    this.statusHUD.update(
      this.playerStatsModel.getHealth(),
      this.playerStatsModel.getHunger()
    );
    if (this.playerStatsModel.isDead()) this.handlePlayerDeath();
    if (Phaser.Input.Keyboard.JustDown(this.saveKey)) this.saveGame();
    if (Phaser.Input.Keyboard.JustDown(this.loadKey)) this.loadGame();
    if (this.isDeathHandled) {
      this.player.setVelocity(0, 0);
      return;
    }

    this.updatePlayerHitFlash();

    if (Phaser.Input.Keyboard.JustDown(this.buildToggleKey) && this.canBuild()) {
      this.toggleBuildMode();
    }
    if (this.buildingSystem.isActive() && Phaser.Input.Keyboard.JustDown(this.cancelBuildKey)) {
      this.exitBuildMode();
    }

    if (!this.canMove()) {
      this.player.setVelocity(0, 0);
      this.updateWorldDepth(this.player);
      return;
    }

    let horizontal = 0;
    let vertical = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) horizontal -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) horizontal += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vertical -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vertical += 1;

    const joystickDirection = this.virtualJoystick.getDirection();
    const movement = this.movementVector.set(
      horizontal + joystickDirection.x,
      vertical + joystickDirection.y
    );

    if (movement.lengthSq() > 0) {
      if (Math.abs(movement.x) >= Math.abs(movement.y)) {
        this.lastFacingDirection = movement.x < 0 ? 'left' : 'right';
      } else {
        this.lastFacingDirection = movement.y < 0 ? 'up' : 'down';
      }
    }

    if (movement.lengthSq() > 1) movement.normalize();
    movement.scale(PLAYER_SPEED);

    this.player.setVelocity(movement.x, movement.y);
    this.updateWorldDepth(this.player);
    this.collectNearbyGroundItems();
    if (this.buildingSystem.isActive()) {
      this.updateBuildingPreview();
      if (Phaser.Input.Keyboard.JustDown(this.placeBuildKey)) this.tryPlaceBuilding();
      return;
    }
    this.updateInteractionTarget();

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this.tryPlayerAttack();

    if (Phaser.Input.Keyboard.JustDown(this.useKey)) {
      this.tryUseActiveItem();
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.startInteractionHold('keyboard');
    }

    if (this.holdInputSource === 'keyboard' && !this.interactKey.isDown) {
      this.releaseInteractionHold('keyboard');
    }

    this.updateInteractionHold(statsDelta);
  }
}
