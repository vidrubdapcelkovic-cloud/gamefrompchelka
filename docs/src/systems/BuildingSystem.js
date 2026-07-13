class BuildingSystem {
  constructor(scene, worldGrid, blockingWorldObjects, textureKeys) {
    this.scene = scene;
    this.worldGrid = worldGrid;
    this.blockingWorldObjects = blockingWorldObjects;
    this.textureKeys = textureKeys;
    this.active = false;
    this.buildType = null;
    this.placements = [];
    this.occupiedCells = new Set();
    this.nextId = 1;
    this.destroyed = false;
    this.previewObject = scene.add.image(0, 0, textureKeys.WOOD_WALL)
      .setAlpha(0.55)
      .setDepth(INTERFACE_DEPTH - 20)
      .setVisible(false);
  }

  enterMode(buildType) {
    if (!BuildCatalog[buildType]) throw new Error(`Неизвестный тип постройки: ${buildType}.`);
    this.active = true;
    this.buildType = buildType;
    return true;
  }

  exitMode() {
    this.active = false;
    this.buildType = null;
    if (this.previewObject && this.previewObject.active) this.previewObject.setVisible(false);
  }

  isActive() {
    return this.active;
  }

  updatePreview(col, row, isValid) {
    if (!this.active || !Number.isInteger(col) || !Number.isInteger(row)) {
      this.previewObject.setVisible(false);
      return;
    }
    const x = col * this.worldGrid.tileSize + this.worldGrid.tileSize / 2;
    const y = row * this.worldGrid.tileSize + this.worldGrid.tileSize / 2;
    this.previewObject
      .setPosition(x, y)
      .setTint(isValid ? 0x67df78 : 0xe55d65)
      .setVisible(true);
  }

  place(col, row) {
    if (!this.active || !this.worldGrid.isInside(col, row) || this.isOccupied(col, row)) {
      return null;
    }
    const definition = BuildCatalog[this.buildType];
    const position = this.worldGrid.cellToWorldCenter(col, row);
    const visualObject = definition.blocksMovement
      ? this.blockingWorldObjects.create(position.x, position.y, this.textureKeys[this.buildType])
      : this.scene.add.image(position.x, position.y, this.textureKeys[this.buildType]);
    visualObject.setDepth((position.y + visualObject.displayHeight / 2) * WORLD_DEPTH_SCALE);
    visualObject.setDataEnabled();
    const id = `building-${this.nextId++}`;
    visualObject.setData('id', id);
    visualObject.setData('buildType', this.buildType);
    visualObject.setData('col', col);
    visualObject.setData('row', row);
    const placement = { id, buildType: this.buildType, col, row, visualObject, active: true };
    this.placements.push(placement);
    this.occupiedCells.add(`${col},${row}`);
    return placement;
  }

  isOccupied(col, row) {
    return this.occupiedCells.has(`${col},${row}`);
  }

  getPlacements() {
    return this.placements.filter((placement) => placement.active).slice();
  }

  exportState() { return this.getPlacements().map(({ buildType, col, row }) => ({ buildType, col, row })); }
  clearPlacements() {
    this.placements.forEach((p) => { if (p.visualObject && p.visualObject.active) p.visualObject.destroy(); p.active = false; });
    this.placements = []; this.occupiedCells.clear();
  }
  restoreState(walls) {
    if (!Array.isArray(walls)) return false; const cells = new Set();
    for (const wall of walls) {
      const key = wall && `${wall.col},${wall.row}`;
      if (!wall || !BuildCatalog[wall.buildType] || !Number.isInteger(wall.col) || !Number.isInteger(wall.row)
        || !this.worldGrid.isInside(wall.col, wall.row) || cells.has(key)) return false;
      cells.add(key);
    }
    this.clearPlacements(); const previousType = this.buildType; const previousActive = this.active;
    walls.forEach((wall) => { this.active = true; this.buildType = wall.buildType; this.place(wall.col, wall.row); });
    this.active = previousActive; this.buildType = previousType; if (!this.active) this.previewObject.setVisible(false); return true;
  }

  clear() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.exitMode();
    this.clearPlacements();
    if (this.previewObject && this.previewObject.active) this.previewObject.destroy();
    this.previewObject = null;
  }
}
