class CraftingModel {
  constructor(inventoryModel) {
    this.inventoryModel = inventoryModel;
  }

  canCraft(recipeId) {
    const recipe = RecipeCatalog[recipeId];
    if (!recipe) throw new Error(`Неизвестный рецепт: ${recipeId}.`);
    const missingIngredients = recipe.ingredients.filter(
      (ingredient) => this.inventoryModel.getTotal(ingredient.itemType) < ingredient.quantity
    );
    return {
      recipeId,
      canCraft: missingIngredients.length === 0,
      reason: missingIngredients.length === 0 ? null : 'missingIngredients'
    };
  }

  craft(recipeId) {
    const recipe = RecipeCatalog[recipeId];
    if (!recipe) throw new Error(`Неизвестный рецепт: ${recipeId}.`);
    const exchange = this.inventoryModel.craftExchange(recipe.ingredients, recipe.result);
    if (!exchange.success) return exchange;
    return {
      success: true,
      recipeId,
      resultItemType: recipe.result.itemType,
      resultQuantity: recipe.result.quantity
    };
  }
}
