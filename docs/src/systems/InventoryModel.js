const INVENTORY_SLOT_COUNT = 25;
const QUICK_SLOT_COUNT = 5;

class InventoryModel {
  constructor() {
    this.slotCount = INVENTORY_SLOT_COUNT;
    this.quickSlotCount = QUICK_SLOT_COUNT;
    this.slots = Array(INVENTORY_SLOT_COUNT).fill(null);
  }

  addItem(itemType, quantity) {
    const itemDefinition = ItemCatalog[itemType];
    if (!itemDefinition) throw new Error(`Неизвестный тип предмета: ${itemType}.`);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Количество предметов должно быть положительным целым числом: ${quantity}.`);
    }

    let remaining = quantity;
    this.slots.forEach((slot) => {
      if (remaining === 0 || slot === null || slot.itemType !== itemType) return;
      const available = itemDefinition.maxStack - slot.quantity;
      const added = Math.min(available, remaining);
      slot.quantity += added;
      remaining -= added;
    });

    for (let index = 0; index < this.slots.length && remaining > 0; index += 1) {
      if (this.slots[index] !== null) continue;
      const added = Math.min(itemDefinition.maxStack, remaining);
      this.slots[index] = { itemType, quantity: added };
      remaining -= added;
    }

    return remaining;
  }

  getSlots() {
    return this.slots.map((slot) => (slot === null ? null : { ...slot }));
  }

  getTotal(itemType) {
    if (!ItemCatalog[itemType]) throw new Error(`Неизвестный тип предмета: ${itemType}.`);
    return this.slots.reduce(
      (total, slot) => total + (slot && slot.itemType === itemType ? slot.quantity : 0),
      0
    );
  }

  clear() {
    this.slots.fill(null);
  }
}
