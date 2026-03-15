import fs from 'fs';

const path = 'c:\\Users\\Juanb\\OneDrive\\Escritorio\\Tactics Bloxugan\\package.json';
const packageJson = JSON.parse(fs.readFileSync(path, 'utf8'));

packageJson.scripts = {
    ...packageJson.scripts,
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
};

fs.writeFileSync(path, JSON.stringify(packageJson, null, 2), 'utf8');
console.log("package.json updated success");
