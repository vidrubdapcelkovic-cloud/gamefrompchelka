const fs = require('fs');
const path = require('path');

const root = __dirname;
const requiredRelativePaths = [
  'index.html',
  'lib/phaser.min.js',
  'src/data/FixedMapData.js',
  'src/data/FixedWorldObjects.js',
  'src/data/ItemCatalog.js',
  'src/data/RecipeCatalog.js',
  'src/world/WorldGrid.js',
  'src/systems/InteractionSystem.js',
  'src/systems/HoldActionSystem.js',
  'src/systems/InventoryModel.js',
  'src/systems/CraftingModel.js',
  'src/systems/PlayerStatsModel.js',
  'src/systems/GroundItemSystem.js',
  'src/ui/StatusHUD.js',
  'src/ui/InventoryUI.js',
  'src/ui/CraftingUI.js',
  'src/VirtualJoystick.js',
  'src/GameScene.js',
  'src/main.js'
];

function requireFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Не найден обязательный файл: ${relativePath}`);
  }
  return absolutePath;
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function writeFileWithSize(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8');
  return fs.statSync(filePath).size;
}

requiredRelativePaths.forEach(requireFile);

const indexHtml = fs.readFileSync(requireFile('index.html'), 'utf8');
const phaser = fs.readFileSync(requireFile('lib/phaser.min.js'), 'utf8');
const fixedMapData = fs.readFileSync(requireFile('src/data/FixedMapData.js'), 'utf8');
const fixedWorldObjects = fs.readFileSync(requireFile('src/data/FixedWorldObjects.js'), 'utf8');
const itemCatalog = fs.readFileSync(requireFile('src/data/ItemCatalog.js'), 'utf8');
const recipeCatalog = fs.readFileSync(requireFile('src/data/RecipeCatalog.js'), 'utf8');
const worldGrid = fs.readFileSync(requireFile('src/world/WorldGrid.js'), 'utf8');
const interactionSystem = fs.readFileSync(requireFile('src/systems/InteractionSystem.js'), 'utf8');
const holdActionSystem = fs.readFileSync(requireFile('src/systems/HoldActionSystem.js'), 'utf8');
const inventoryModel = fs.readFileSync(requireFile('src/systems/InventoryModel.js'), 'utf8');
const craftingModel = fs.readFileSync(requireFile('src/systems/CraftingModel.js'), 'utf8');
const playerStatsModel = fs.readFileSync(requireFile('src/systems/PlayerStatsModel.js'), 'utf8');
const groundItemSystem = fs.readFileSync(requireFile('src/systems/GroundItemSystem.js'), 'utf8');
const statusHUD = fs.readFileSync(requireFile('src/ui/StatusHUD.js'), 'utf8');
const inventoryUI = fs.readFileSync(requireFile('src/ui/InventoryUI.js'), 'utf8');
const craftingUI = fs.readFileSync(requireFile('src/ui/CraftingUI.js'), 'utf8');
const virtualJoystick = fs.readFileSync(requireFile('src/VirtualJoystick.js'), 'utf8');
const gameScene = fs.readFileSync(requireFile('src/GameScene.js'), 'utf8');
const main = fs.readFileSync(requireFile('src/main.js'), 'utf8');

const styleMatch = indexHtml.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) {
  throw new Error('Не удалось найти CSS внутри index.html.');
}
const pageCss = styleMatch[1].trim() + '\n';

// Do not let embedded source accidentally close the autonomous script tag.
const safeScript = (source) => source
  .replace(/<\/script/gi, '<\\/script')
  // Preserve Phaser's generic local-scheme value without emitting a file URL.
  .replace(/file:\/\//gi, 'file:\\x2f\\x2f');

const autonomousHtml = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <title>Прототип выживалки — автономная версия</title>
    <style>\n${pageCss}    </style>
  </head>
  <body>
    <div id="game-container"></div>
    <script>
${safeScript(phaser)}
${safeScript(fixedMapData)}
${safeScript(fixedWorldObjects)}
${safeScript(itemCatalog)}
${safeScript(recipeCatalog)}
${safeScript(worldGrid)}
${safeScript(interactionSystem)}
${safeScript(holdActionSystem)}
${safeScript(inventoryModel)}
${safeScript(craftingModel)}
${safeScript(playerStatsModel)}
${safeScript(groundItemSystem)}
${safeScript(statusHUD)}
${safeScript(inventoryUI)}
${safeScript(craftingUI)}
${safeScript(virtualJoystick)}
${safeScript(gameScene)}
${safeScript(main)}
    </script>
  </body>
</html>
`;

const pagesHtml = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <title>Прототип выживалки</title>
    <link rel="stylesheet" href="./styles/game.css">
  </head>
  <body>
    <div id="game-container"></div>
    <script src="./lib/phaser.min.js"></script>
    <script src="./src/data/FixedMapData.js"></script>
    <script src="./src/data/FixedWorldObjects.js"></script>
    <script src="./src/data/ItemCatalog.js"></script>
    <script src="./src/data/RecipeCatalog.js"></script>
    <script src="./src/world/WorldGrid.js"></script>
    <script src="./src/systems/InteractionSystem.js"></script>
    <script src="./src/systems/HoldActionSystem.js"></script>
    <script src="./src/systems/InventoryModel.js"></script>
    <script src="./src/systems/CraftingModel.js"></script>
    <script src="./src/systems/PlayerStatsModel.js"></script>
    <script src="./src/systems/GroundItemSystem.js"></script>
    <script src="./src/ui/StatusHUD.js"></script>
    <script src="./src/ui/InventoryUI.js"></script>
    <script src="./src/ui/CraftingUI.js"></script>
    <script src="./src/VirtualJoystick.js"></script>
    <script src="./src/GameScene.js"></script>
    <script src="./src/main.js"></script>
  </body>
</html>
`;

const distDirectory = path.join(root, 'dist');
ensureDirectory(distDirectory);
const autonomousPath = path.join(distDirectory, 'survival-offline.html');
const autonomousSize = writeFileWithSize(autonomousPath, autonomousHtml);

const docsDirectory = path.join(root, 'docs');
const docsLibDirectory = path.join(docsDirectory, 'lib');
const docsSrcDirectory = path.join(docsDirectory, 'src');
const docsDataDirectory = path.join(docsSrcDirectory, 'data');
const docsWorldDirectory = path.join(docsSrcDirectory, 'world');
const docsSystemsDirectory = path.join(docsSrcDirectory, 'systems');
const docsUiDirectory = path.join(docsSrcDirectory, 'ui');
const docsStylesDirectory = path.join(docsDirectory, 'styles');
const assetDirectories = ['images', 'sprites', 'audio', 'maps', 'data']
  .map((name) => path.join(docsDirectory, 'assets', name));

[docsDirectory, docsLibDirectory, docsSrcDirectory, docsDataDirectory, docsWorldDirectory, docsSystemsDirectory, docsUiDirectory, docsStylesDirectory, ...assetDirectories]
  .forEach(ensureDirectory);

const pagesIndexPath = path.join(docsDirectory, 'index.html');
const pagesCssPath = path.join(docsStylesDirectory, 'game.css');
const pagesIndexSize = writeFileWithSize(pagesIndexPath, pagesHtml);
writeFileWithSize(pagesCssPath, pageCss);
fs.copyFileSync(requireFile('lib/phaser.min.js'), path.join(docsLibDirectory, 'phaser.min.js'));
fs.copyFileSync(requireFile('src/data/FixedMapData.js'), path.join(docsDataDirectory, 'FixedMapData.js'));
fs.copyFileSync(requireFile('src/data/FixedWorldObjects.js'), path.join(docsDataDirectory, 'FixedWorldObjects.js'));
fs.copyFileSync(requireFile('src/data/ItemCatalog.js'), path.join(docsDataDirectory, 'ItemCatalog.js'));
fs.copyFileSync(requireFile('src/data/RecipeCatalog.js'), path.join(docsDataDirectory, 'RecipeCatalog.js'));
fs.copyFileSync(requireFile('src/world/WorldGrid.js'), path.join(docsWorldDirectory, 'WorldGrid.js'));
fs.copyFileSync(requireFile('src/systems/InteractionSystem.js'), path.join(docsSystemsDirectory, 'InteractionSystem.js'));
fs.copyFileSync(requireFile('src/systems/HoldActionSystem.js'), path.join(docsSystemsDirectory, 'HoldActionSystem.js'));
fs.copyFileSync(requireFile('src/systems/InventoryModel.js'), path.join(docsSystemsDirectory, 'InventoryModel.js'));
fs.copyFileSync(requireFile('src/systems/CraftingModel.js'), path.join(docsSystemsDirectory, 'CraftingModel.js'));
fs.copyFileSync(requireFile('src/systems/PlayerStatsModel.js'), path.join(docsSystemsDirectory, 'PlayerStatsModel.js'));
fs.copyFileSync(requireFile('src/systems/GroundItemSystem.js'), path.join(docsSystemsDirectory, 'GroundItemSystem.js'));
fs.copyFileSync(requireFile('src/ui/StatusHUD.js'), path.join(docsUiDirectory, 'StatusHUD.js'));
fs.copyFileSync(requireFile('src/ui/InventoryUI.js'), path.join(docsUiDirectory, 'InventoryUI.js'));
fs.copyFileSync(requireFile('src/ui/CraftingUI.js'), path.join(docsUiDirectory, 'CraftingUI.js'));
fs.copyFileSync(requireFile('src/VirtualJoystick.js'), path.join(docsSrcDirectory, 'VirtualJoystick.js'));
fs.copyFileSync(requireFile('src/GameScene.js'), path.join(docsSrcDirectory, 'GameScene.js'));
fs.copyFileSync(requireFile('src/main.js'), path.join(docsSrcDirectory, 'main.js'));
writeFileWithSize(path.join(docsDirectory, '.nojekyll'), '');

assetDirectories.forEach((directoryPath) => {
  if (fs.readdirSync(directoryPath).length === 0) {
    writeFileWithSize(path.join(directoryPath, '.gitkeep'), '');
  }
});

console.log(`Автономная версия: ${autonomousPath} (${autonomousSize} байт)`);
console.log(`GitHub Pages: ${pagesIndexPath} (${pagesIndexSize} байт)`);
console.log(`Phaser: ${path.join(docsLibDirectory, 'phaser.min.js')} (${fs.statSync(path.join(docsLibDirectory, 'phaser.min.js')).size} байт)`);
console.log(`CSS: ${pagesCssPath} (${fs.statSync(pagesCssPath).size} байт)`);
