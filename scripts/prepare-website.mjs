import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = `${root}font/dist`;
const manifest = JSON.parse(readFileSync(`${source}/satoma-sans-manifest.json`, "utf8"));
// Generated copies are ignored by Git; font/dist is the only font output source.
rmSync(`${root}website/public/fonts`, { recursive: true, force: true });
mkdirSync(`${root}website/public/fonts`, { recursive: true });
cpSync(source, `${root}website/public/fonts`, { recursive: true });
writeFileSync(`${root}website/src/font-manifest.json`, JSON.stringify(manifest));
