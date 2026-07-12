const PLAYER_SPEED = 260;
const SURFACE_TILE_INDICES = Object.freeze({ G: 0, S: 1, W: 2, R: 3 });

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.createWorld();
    this.createPlayer();
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
      .setScrollFactor(0);
    panel.setStrokeStyle(2, 0xbad5e8, 0.5);

    this.add.text(34, 30, 'Прототип выживалки', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff'
    }).setScrollFactor(0);

    this.add.text(34, 61, 'Этап 1: основа', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#bde6ff'
    }).setScrollFactor(0);

    this.add.text(34, 88, 'Управление: WASD, стрелки или джойстик', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#e7edf2'
    }).setScrollFactor(0);
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
  }
}
