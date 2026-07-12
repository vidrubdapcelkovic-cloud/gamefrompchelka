const BuildCatalog = Object.freeze({
  WOOD_WALL: Object.freeze({
    id: 'WOOD_WALL',
    displayName: 'Деревянная стена',
    widthCells: 1,
    heightCells: 1,
    blocksMovement: true,
    cost: Object.freeze([
      Object.freeze({ itemType: 'WOOD', quantity: 2 })
    ])
  })
});
