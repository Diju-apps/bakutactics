import fs from 'fs';

const path = 'c:\\Users\\Juanb\\OneDrive\\Escritorio\\Tactics Bloxugan\\vite.config.ts';
let content = fs.readFileSync(path, 'utf8');

const target = 'export default defineConfig({';
const replacement = 'export default defineConfig({\n  base: "./",';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("vite.config.ts updated success");
} else {
    console.log("target not found");
}
