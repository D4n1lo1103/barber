// Marca la cartella dist/esm come modulo ES, così Node e i bundler
// interpretano correttamente l'output generato da tsconfig.esm.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cartellaEsm = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm');
mkdirSync(cartellaEsm, { recursive: true });
writeFileSync(
  resolve(cartellaEsm, 'package.json'),
  `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
);
