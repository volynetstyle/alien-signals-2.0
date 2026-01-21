import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
  getParsedCommandLineOfConfigFile,
  sys,
  createProgram,
} from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = getParsedCommandLineOfConfigFile(
  join(__dirname, "tsconfig.json"),
  undefined,
  { ...sys, onUnRecoverableConfigFileDiagnostic: () => {} }
);

if (!config) {
  console.error("Failed to parse tsconfig.json");
  process.exit(1);
}

// ---- types
createProgram({
  rootNames: config.fileNames,
  configFileParsingDiagnostics: config.errors,
  options: {
    ...config.options,
    outDir: "types",
    declaration: true,
    emitDeclarationOnly: true,
  },
}).emit(undefined, sys.writeFile);

// ---- one bundle entry
const entry = join(__dirname, "src/bundle.ts");

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: "dist/alien-signals.mjs",
  sourcemap: false,
  minify: true,
  target: "es2020",
});

await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "dist/alien-signals.cjs",
  sourcemap: false,
  minify: true,
  target: "es2020",
});
