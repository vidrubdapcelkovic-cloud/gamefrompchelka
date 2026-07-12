const PLAYER_SPEED = 260;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1200;

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
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const graphics = this.add.graphics().setDepth(-20);
    graphics.fillStyle(0x527a45, 1);
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    graphics.lineStyle(2, 0x5f8b50, 0.55);
    for (let x = 0; x <= WORLD_WIDTH; x += 80) {
      graphics.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 80) {
      graphics.lineBetween(0, y, WORLD_WIDTH, y);
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
    graphics.strokeRect(8, 8, WORLD_WIDTH - 16, WORLD_HEIGHT - 16);
    graphics.lineStyle(4, 0x3b2f21, 1);
    graphics.strokeRect(18, 18, WORLD_WIDTH - 36, WORLD_HEIGHT - 36);

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

    const tileIndices = { G: 0, S: 1, W: 2, R: 3 };
    const numericMap = FixedMapData.tiles.map((row) => (
      Array.from(row, (tileType) => tileIndices[tileType])
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

    this.player = this.physics.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(40, 40);
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
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
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
