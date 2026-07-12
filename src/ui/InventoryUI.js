class InventoryUI {
  constructor(scene, inventoryModel, textureKeys, onOpenChanged) {
    this.scene = scene;
    this.inventoryModel = inventoryModel;
    this.textureKeys = textureKeys;
    this.onOpenChanged = onOpenChanged;
    this.activeQuickSlotIndex = 0;
    this.isOpen = false;
    this.destroyed = false;
    this.backpackPointerId = null;
    this.backpackNativePointerId = null;
    this.elements = [];
    this.quickSlots = [];
    this.mainSlots = [];
    this.panelElements = [];

    this.createQuickSlots();
    this.createMainPanel();
    this.createBackpackButton();
    this.registerHandlers();
    this.reposition();
    this.updateFromModel();
  }

  createSlot(x, y, slotIndex, interactive) {
    const background = this.scene.add.rectangle(x, y, 48, 48, 0x1b2731, 0.94)
      .setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 22)
      .setStrokeStyle(2, 0x78909f, 0.8);
    const icon = this.scene.add.image(x, y - 3, 'temporary-ground-wood')
      .setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 23)
      .setVisible(false);
    const quantityText = this.scene.add.text(x + 17, y + 16, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#101820',
      strokeThickness: 3
    }).setOrigin(1).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 24);
    const slot = { slotIndex, background, icon, quantityText };
    this.elements.push(background, icon, quantityText);

    if (interactive) {
      background.setInteractive();
      slot.onPointerDown = (pointer, localX, localY, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        this.setActiveQuickSlot(slotIndex);
      };
      background.on('pointerdown', slot.onPointerDown);
    }
    return slot;
  }

  createQuickSlots() {
    for (let index = 0; index < 5; index += 1) {
      this.quickSlots.push(this.createSlot(0, 0, index, true));
    }
  }

  createMainPanel() {
    this.panelBackground = this.scene.add.rectangle(480, 270, 340, 270, 0x0d141b, 0.94)
      .setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 20)
      .setStrokeStyle(3, 0xbad5e8, 0.75);
    this.panelTitle = this.scene.add.text(480, 162, 'Инвентарь', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 21);
    this.elements.push(this.panelBackground, this.panelTitle);
    this.panelElements.push(this.panelBackground, this.panelTitle);

    for (let index = 5; index < 25; index += 1) {
      const slot = this.createSlot(0, 0, index, false);
      this.mainSlots.push(slot);
      this.panelElements.push(slot.background, slot.icon, slot.quantityText);
    }
    this.setPanelVisible(false);
  }

  createBackpackButton() {
    this.backpackButton = this.scene.add.circle(0, 0, 28, 0x263642, 0.88)
      .setScrollFactor(0)
      .setDepth(INTERFACE_DEPTH + 30)
      .setStrokeStyle(2, 0xbad5e8, 0.8)
      .setInteractive();
    this.backpackLabel = this.scene.add.text(0, 0, '🎒', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(INTERFACE_DEPTH + 31);
    this.elements.push(this.backpackButton, this.backpackLabel);
  }

  registerHandlers() {
    this.onQuickKey = (index) => (event) => {
      if (!event || !event.repeat) this.setActiveQuickSlot(index);
    };
    this.quickKeyHandlers = [0, 1, 2, 3, 4].map((index) => this.onQuickKey(index));
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((keyName, index) => {
      this.scene.input.keyboard.on(`keydown-${keyName}`, this.quickKeyHandlers[index]);
    });
    this.onToggleKey = (event) => {
      if (!event || !event.repeat) this.togglePanel();
    };
    this.onEscapeKey = (event) => {
      if (!event || !event.repeat) this.closePanel();
    };
    this.scene.input.keyboard.on('keydown-I', this.onToggleKey);
    this.scene.input.keyboard.on('keydown-ESC', this.onEscapeKey);

    this.onBackpackPointerDown = (pointer, localX, localY, event) => {
      if (this.backpackPointerId !== null) return;
      if (event && event.stopPropagation) event.stopPropagation();
      this.backpackPointerId = pointer.id;
      this.backpackNativePointerId = pointer.event ? pointer.event.pointerId : null;
      this.backpackButton.setScale(0.92);
      this.backpackLabel.setScale(0.92);
      this.togglePanel();
    };
    this.onBackpackPointerEnd = (pointer) => {
      if (pointer.id === this.backpackPointerId) this.resetBackpackPointer();
    };
    this.onWindowPointerEnd = (event) => {
      if (event.pointerId === this.backpackNativePointerId) this.resetBackpackPointer();
    };
    this.onBlur = () => this.resetBackpackPointer();
    this.onVisibilityChange = () => {
      if (document.hidden) this.resetBackpackPointer();
    };
    this.onResize = () => this.reposition();

    this.backpackButton.on('pointerdown', this.onBackpackPointerDown);
    this.scene.input.on('pointerup', this.onBackpackPointerEnd);
    this.scene.input.on('pointerupoutside', this.onBackpackPointerEnd);
    this.scene.scale.on('resize', this.onResize);
    window.addEventListener('pointerup', this.onWindowPointerEnd);
    window.addEventListener('pointercancel', this.onWindowPointerEnd);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  reposition() {
    const width = this.scene.scale.gameSize.width;
    const height = this.scene.scale.gameSize.height;
    const quickStartX = width / 2 - 104;
    this.quickSlots.forEach((slot, index) => {
      const x = quickStartX + index * 52;
      const y = height - 34;
      slot.background.setPosition(x, y);
      slot.icon.setPosition(x, y - 3);
      slot.quantityText.setPosition(x + 17, y + 16);
    });

    this.panelBackground.setPosition(width / 2, height / 2);
    this.panelTitle.setPosition(width / 2, height / 2 - 108);
    this.mainSlots.forEach((slot, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = width / 2 - 112 + col * 56;
      const y = height / 2 - 65 + row * 56;
      slot.background.setPosition(x, y);
      slot.icon.setPosition(x, y - 3);
      slot.quantityText.setPosition(x + 17, y + 16);
    });
    this.backpackButton.setPosition(width - 52, 52);
    this.backpackLabel.setPosition(width - 52, 52);
  }

  updateFromModel() {
    const slots = this.inventoryModel.getSlots();
    [...this.quickSlots, ...this.mainSlots].forEach((slot) => {
      const contents = slots[slot.slotIndex];
      if (contents) {
        const definition = ItemCatalog[contents.itemType];
        if (!definition || !this.textureKeys[contents.itemType]) {
          throw new Error(`Нельзя отобразить предмет: ${contents.itemType}.`);
        }
        slot.icon.setTexture(this.textureKeys[contents.itemType]).setVisible(true);
        slot.quantityText.setText(String(contents.quantity)).setVisible(true);
      } else {
        slot.icon.setVisible(false);
        slot.quantityText.setText('').setVisible(false);
      }
    });
    this.updateQuickSlotSelection();
  }

  setActiveQuickSlot(index) {
    if (!Number.isInteger(index) || index < 0 || index >= 5) return false;
    this.activeQuickSlotIndex = index;
    this.updateQuickSlotSelection();
    return true;
  }

  updateQuickSlotSelection() {
    this.quickSlots.forEach((slot, index) => {
      const active = index === this.activeQuickSlotIndex;
      slot.background.setStrokeStyle(active ? 4 : 2, active ? 0xffdf6b : 0x78909f, 1);
    });
  }

  togglePanel() {
    if (this.isOpen) this.closePanel();
    else this.openPanel();
  }

  openPanel() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.updateFromModel();
    this.setPanelVisible(true);
    this.onOpenChanged(true);
  }

  closePanel() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.setPanelVisible(false);
    this.onOpenChanged(false);
  }

  setPanelVisible(visible) {
    this.panelElements.forEach((element) => element.setVisible(visible));
  }

  resetBackpackPointer() {
    this.backpackPointerId = null;
    this.backpackNativePointerId = null;
    if (this.backpackButton && this.backpackButton.active) this.backpackButton.setScale(1);
    if (this.backpackLabel && this.backpackLabel.active) this.backpackLabel.setScale(1);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resetBackpackPointer();
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((keyName, index) => {
      this.scene.input.keyboard.off(`keydown-${keyName}`, this.quickKeyHandlers[index]);
    });
    this.scene.input.keyboard.off('keydown-I', this.onToggleKey);
    this.scene.input.keyboard.off('keydown-ESC', this.onEscapeKey);
    this.backpackButton.off('pointerdown', this.onBackpackPointerDown);
    this.quickSlots.forEach((slot) => slot.background.off('pointerdown', slot.onPointerDown));
    this.scene.input.off('pointerup', this.onBackpackPointerEnd);
    this.scene.input.off('pointerupoutside', this.onBackpackPointerEnd);
    this.scene.scale.off('resize', this.onResize);
    window.removeEventListener('pointerup', this.onWindowPointerEnd);
    window.removeEventListener('pointercancel', this.onWindowPointerEnd);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    new Set(this.elements).forEach((element) => {
      if (element && element.active) element.destroy();
    });
    this.elements = [];
    this.quickSlots = [];
    this.mainSlots = [];
    this.panelElements = [];
  }
}
