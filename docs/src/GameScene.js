const PLAYER_SPEED = 260;
const SURFACE_TILE_INDICES = Object.freeze({ G: 0, S: 1, W: 2, R: 3 });
const WORLD_OBJECT_TYPES = Object.freeze(['TREE', 'ROCK', 'BERRY_BUSH']);
const WORLD_DEPTH_SCALE = 0.1;
const INTERFACE_DEPTH = 2000;

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.createWorld();
    this.createPlayer();
    this.createWorldObjects();
    this.createControls();
    this.createCamera();
    this.createInterface();
    this.createVirtualJoystick();
    this.registerLifecycleHandlers();
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

    this.worldObjects = [];
    this.treeBlockers = [];
    this.blockingWorldObjects = this.physics.add.staticGroup();

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
      } else if (objectData.type === 'ROCK') {
        gameObject.body.setSize(24, 18);
        gameObject.body.setOffset(4, 14);
        gameObject.refreshBody();
      }

      this.worldObjects.push(gameObject);
    });

    this.validateTreeBlockerGeometry();
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
  }

  createVirtualJoystick() {
    this.virtualJoystick = new VirtualJoystick(this);
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
  }

  update() {
    let horizontal = 0;
    let vertical = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) horizontal -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) horizontal += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vertical -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vertical += 1;

    const joystickDirection = this.virtualJoystick.getDirection();
    const movement = new Phaser.Math.Vector2(
      horizontal + joystickDirection.x,
      vertical + joystickDirection.y
    );

    if (movement.lengthSq() > 1) movement.normalize();
    movement.scale(PLAYER_SPEED);

    this.player.setVelocity(movement.x, movement.y);
    this.updateWorldDepth(this.player);
  }
}
