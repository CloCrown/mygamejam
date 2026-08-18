import { execSync } from 'node:child_process';
import fs from 'node:fs';

const zipPath = 'mygamejam.zip';
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path 'index.html','dist' -DestinationPath '${zipPath}' -Force"`,
  { stdio: 'inherit' }
);

const { size } = fs.statSync(zipPath);
const limit = 13312;
console.log(`Taille du zip: ${size} octets / ${limit} octets (${((size / limit) * 100).toFixed(1)}%)`);
if (size > limit) {
  console.error('ATTENTION: depasse la limite js13k de 13 Ko !');
  process.exitCode = 1;
}
