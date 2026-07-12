const ItemCatalog = Object.freeze({
  WOOD: Object.freeze({ id: 'WOOD', displayName: 'Дерево', maxStack: 99, consumable: false }),
  STONE: Object.freeze({ id: 'STONE', displayName: 'Камень', maxStack: 99, consumable: false }),
  BERRIES: Object.freeze({
    id: 'BERRIES',
    displayName: 'Ягоды',
    maxStack: 99,
    consumable: true,
    hungerRestore: 20
  })
});
