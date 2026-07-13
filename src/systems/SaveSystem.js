const STORAGE_KEY = 'survival-save-v1';
const VERSION = 1;

class SaveSystem {
  constructor(storage) {
    if (storage !== undefined) this.storage = storage;
    else { try { this.storage = globalThis.localStorage; } catch { this.storage = null; } }
  }

  normalize(state) {
    try {
      if (!state || state.version !== VERSION || !Number.isFinite(state.savedAt)) return null;
      const p = state.player, inv = state.inventory, w = state.world;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)
        || !Number.isFinite(p.health) || p.health < 0 || p.health > 100
        || !Number.isFinite(p.hunger) || p.hunger < 0 || p.hunger > 100) return null;
      if (!inv || !Number.isInteger(inv.activeHotbarIndex) || inv.activeHotbarIndex < 0
        || inv.activeHotbarIndex > 4 || !Array.isArray(inv.slots) || inv.slots.length !== 25) return null;
      const slots = inv.slots.map((slot) => {
        if (slot === null) return null;
        if (!slot || !ItemCatalog[slot.itemType] || !Number.isInteger(slot.quantity)
          || slot.quantity <= 0 || slot.quantity > ItemCatalog[slot.itemType].maxStack) throw new Error();
        return { itemType: slot.itemType, quantity: slot.quantity };
      });
      if (!w) return null;
      const uniqueStrings = (value) => Array.isArray(value) && value.every((v) => typeof v === 'string')
        && new Set(value).size === value.length ? value.slice() : null;
      const removedObjectIds = uniqueStrings(w.removedObjectIds);
      const deadCreatureIds = uniqueStrings(w.deadCreatureIds);
      if (!removedObjectIds || !deadCreatureIds || !Array.isArray(w.groundItems) || !Array.isArray(w.walls)) return null;
      const groundItems = w.groundItems.map((item) => {
        if (!item || !ItemCatalog[item.itemType] || !Number.isInteger(item.quantity)
          || item.quantity <= 0 || item.quantity > ItemCatalog[item.itemType].maxStack
          || !Number.isFinite(item.x) || !Number.isFinite(item.y)) throw new Error();
        return { itemType: item.itemType, quantity: item.quantity, x: item.x, y: item.y };
      });
      const wallCells = new Set();
      const walls = w.walls.map((wall) => {
        if (!wall || !BuildCatalog[wall.buildType] || !Number.isInteger(wall.col) || !Number.isInteger(wall.row)
          || wall.col < 0 || wall.col >= 48 || wall.row < 0 || wall.row >= 36) throw new Error();
        const key = `${wall.col},${wall.row}`; if (wallCells.has(key)) throw new Error(); wallCells.add(key);
        return { buildType: wall.buildType, col: wall.col, row: wall.row };
      });
      return { version: 1, savedAt: state.savedAt,
        player: { x: p.x, y: p.y, health: p.health, hunger: p.hunger },
        inventory: { activeHotbarIndex: inv.activeHotbarIndex, slots },
        world: { removedObjectIds, groundItems, walls, deadCreatureIds } };
    } catch { return null; }
  }

  hasSave() { try { return this.storage.getItem(STORAGE_KEY) !== null; } catch { return false; } }
  save(state) { try { const normalized = this.normalize(state); if (!normalized) return { success: false, reason: 'invalidData' }; this.storage.setItem(STORAGE_KEY, JSON.stringify(normalized)); return { success: true }; } catch { return { success: false, reason: 'storageError' }; } }
  load() { try { const raw = this.storage.getItem(STORAGE_KEY); if (raw === null) return { success: false, reason: 'notFound' }; let parsed; try { parsed = JSON.parse(raw); } catch { return { success: false, reason: 'invalidData' }; } const state = this.normalize(parsed); return state ? { success: true, state } : { success: false, reason: 'invalidData' }; } catch { return { success: false, reason: 'storageError' }; } }
  deleteSave() { try { this.storage.removeItem(STORAGE_KEY); return { success: true }; } catch { return { success: false, reason: 'storageError' }; } }
}
