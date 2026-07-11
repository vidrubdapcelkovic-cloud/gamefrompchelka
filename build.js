const fs = require('fs');
const path = require('path');

const root = __dirname;
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const phaser = fs.readFileSync(path.join(root, 'lib', 'phaser.min.js'), 'utf8');
const virtualJoystick = fs.readFileSync(path.join(root, 'src', 'VirtualJoystick.js'), 'utf8');
const gameScene = fs.readFileSync(path.join(root, 'src', 'GameScene.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const styleMatch = indexHtml.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) {
  throw new Error('Не удалось найти CSS внутри index.html.');
}

// Не даём последовательности </script> случайно закрыть встроенный скрипт.
const safeScript = (source) => source
  .replace(/<\/script/gi, '<\\/script')
  // Keep Phaser's generic local-scheme value without emitting a file:// URL.
  .replace(/file:\/\//gi, 'file:\\x2f\\x2f');
const output = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Прототип выживалки — автономная версия</title>
    <style>${styleMatch[1]}</style>
  </head>
  <body>
    <div id="game-container"></div>
    <script>
${safeScript(phaser)}
${safeScript(virtualJoystick)}
${safeScript(gameScene)}
${safeScript(main)}
    </script>
  </body>
</html>
`;

const distDirectory = path.join(root, 'dist');
fs.mkdirSync(distDirectory, { recursive: true });

const outputPath = path.join(distDirectory, 'survival-offline.html');
fs.writeFileSync(outputPath, output, 'utf8');

const docsDirectory = path.join(root, 'docs');
fs.mkdirSync(docsDirectory, { recursive: true });

const pagesOutputPath = path.join(docsDirectory, 'index.html');
const noJekyllPath = path.join(docsDirectory, '.nojekyll');
fs.writeFileSync(pagesOutputPath, output, 'utf8');
fs.writeFileSync(noJekyllPath, '', 'utf8');

console.log(`Готово: ${outputPath}`);
console.log(`GitHub Pages: ${pagesOutputPath}`);
