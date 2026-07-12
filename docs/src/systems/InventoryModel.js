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

  validateSlotIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_SLOT_COUNT) {
      throw new Error(`Индекс слота должен быть целым числом от 0 до 24: ${index}.`);
    }
  }

  getSlot(index) {
    this.validateSlotIndex(index);
    const slot = this.slots[index];
    return slot === null ? null : { ...slot };
  }

  moveOrMerge(fromIndex, toIndex) {
    this.validateSlotIndex(fromIndex);
    this.validateSlotIndex(toIndex);
    if (fromIndex === toIndex) return false;

    const source = this.slots[fromIndex];
    if (source === null) return false;
    const target = this.slots[toIndex];

    if (target === null) {
      this.slots[toIndex] = source;
      this.slots[fromIndex] = null;
      return { type: 'move', movedQuantity: source.quantity };
    }

    if (target.itemType === source.itemType) {
      const maxStack = ItemCatalog[source.itemType].maxStack;
      const available = maxStack - target.quantity;
      if (available <= 0) return false;

      const movedQuantity = Math.min(available, source.quantity);
      target.quantity += movedQuantity;
      source.quantity -= movedQuantity;
      if (source.quantity === 0) this.slots[fromIndex] = null;
      return { type: 'merge', movedQuantity };
    }

    this.slots[fromIndex] = target;
    this.slots[toIndex] = source;
    return { type: 'swap', movedQuantity: source.quantity };
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
