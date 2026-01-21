import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

import esbuild from "esbuild";
import { getParsedCommandLineOfConfigFile, sys, createProgram } from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** ---------------------------
 *  Parse tsconfig
 *  -------------------------- */
const config = getParsedCommandLineOfConfigFile(
	join(__dirname, "tsconfig.json"),
	undefined,
	{ ...sys, onUnRecoverableConfigFileDiagnostic: () => { } }
);

if (!config) {
	console.error("Failed to parse tsconfig.json");
	process.exit(1);
}

/**
 * ВАЖНО:
 *  esbuild entrypoints = все исходники проекта — обычно плохая идея,
 *  но раз ты повторяешь поведение tsc emit "по файлам", оставим.
 */
const entryPoints = config.fileNames.filter((f) => {
	const ext = extname(f);
	// Exclude flags.ts from entry points (will be inlined)
	if (f.endsWith("flags.ts") || f.endsWith("flags.tsx")) {
		return false;
	}
	return ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts";
});

/** ---------------------------
 *  Enum transformer (best-effort)
 *  -------------------------- */
const iifeRe =
	/(export\s*)?var\s+([A-Za-z_$][\w$]*)\s*;\s*\(\s*function\s*\(\s*\2\s*\)\s*\{\s*([\s\S]*?)\s*\}\s*\)\s*\(\s*\2\s*\|\|\s*\(\s*(?:exports\.\2\s*=\s*)?\2\s*=\s*\{\}\s*\)\s*\)\s*;?/g;

const entryRe = /\[\s*(['"])([^'"]+)\1\s*\]\s*=\s*([^\]]+?)\s*\]/g;

/** ---------------------------
 *  Inline ReactiveFlags constants
 *  -------------------------- */
function inlineReactiveFlags(code) {
	// Map of flag names to their values
	const flagValues = {
		None: "0",
		Mutable: "1",
		Watching: "2",
		RecursedCheck: "4",
		Recursed: "8",
		Dirty: "16",
		Pending: "32",
	};

	// Replace occurrences like `ReactiveFlags.X` or `<alias>.X` (e.g. `import_flags.X`) with numeric values.
	// This uses a regex that finds any identifier followed by a dot and one of the known flag names.
	// It intentionally does not preserve the left-hand identifier because we want to replace the whole
	// property access with a numeric literal.
	let result = code;
	const names = Object.keys(flagValues).join("|");
	const globalRegex = new RegExp(`\\b[A-Za-z_$][\\w$]*\\.(${names})\\b`, 'g');
	result = result.replace(globalRegex, (_, flagName) => flagValues[flagName] ?? _);

	// Also replace direct `ReactiveFlags.X` occurrences just in case (redundant but safe)
	for (const [flagName, flagValue] of Object.entries(flagValues)) {
		const flagRegex = new RegExp(`ReactiveFlags\\.${flagName}\\b`, 'g');
		result = result.replace(flagRegex, flagValue);
	}

	// Replace cases where the transpiler emitted alias.NUM (e.g. import_flags.2) —
	// these should become the numeric literal (2).
	result = result.replace(/\b[A-Za-z_$][\w$]*\.(\d+)\b/g, (_, num) => num);

	// Remove direct requires/imports of the flags module (they're now inlined).
	// Examples to match:
	//   var import_flags = require("./flags.js");
	//   var import_flags = require("./flags.cjs");
	//   import * as import_flags from "./flags.js";
	result = result.replace(/var\s+[A-Za-z_$][\w$]*\s*=\s*require\(["']\.\/flags(?:\.[^"']+)?["']\);?\n?/g, '');
	result = result.replace(/import\s+\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s+["']\.\/flags(?:\.[^"']+)?["'];?\n?/g, '');

	return result;
}

function transformEnumsToConst(code) {
	return code.replace(iifeRe, (whole, esmExport, name, body) => {
		const props = Array.from(body.matchAll(entryRe), ([, , k, v]) => `    ${k}: ${v},`);
		if (!props.length) return whole;
		const left = esmExport ? `export const ${name}` : `exports.${name}`;
		return `${left} = {\n${props.join("\n")}\n};`;
	});
}

/** ---------------------------
 *  Emit types (TS only)
 *  -------------------------- */
function emitTypes() {
	const program = createProgram({
		rootNames: config.fileNames,
		configFileParsingDiagnostics: config.errors,
		options: {
			...config.options,
			outDir: "types",
			declaration: true,
			emitDeclarationOnly: true,
			declarationMap: false,
		},
	});

	const emitResult = program.emit(undefined, sys.writeFile);

	if (emitResult.emitSkipped) {
		console.error("Failed to emit types");
		process.exit(1);
	}
}

/** ---------------------------
 *  Rewrite ESM/CJS internal imports
 *
 *  Fixes:
 *   - "./x.js"      -> "./x.mjs" / "./x.cjs"
 *   - "./x"         -> "./x.mjs" (ONLY for ESM build)
 *
 *  Does NOT touch:
 *   - "react"
 *   - "node:path"
 *   - "./x.json"
 *   - "./x.mjs"
 * -------------------------- */
function rewriteInternalImports(code, { format, outExt }) {
	// Rewrite relative explicit .js
	code = code.replace(
		/(from\s*["'])(\.(?:\/|\.\.\/)[^"']+?)\.js(["'])/g,
		(_, a, p, b) => `${a}${p}${outExt}${b}`
	);
	code = code.replace(
		/(import\s*\(\s*["'])(\.(?:\/|\.\.\/)[^"']+?)\.js(["']\s*\))/g,
		(_, a, p, b) => `${a}${p}${outExt}${b}`
	);

	// Rewrite CommonJS require("./x.js") -> require("./x.cjs") for CJS output
	code = code.replace(
		/require\(["'](\.(?:\/|\.\.\/)[^"']+?)\.js["']\)/g,
		(_, p) => `require("${p}${outExt}")`
	);

	// For ESM: rewrite extensionless relative imports
	if (format === "esm") {
		code = code.replace(
			/(from\s*["'])(\.(?:\/|\.\.\/)[^"'?#]+?)(["'])/g,
			(whole, a, p, b) => {
				if (/\.[a-zA-Z0-9]+$/.test(p)) return whole; // already has extension
				return `${a}${p}${outExt}${b}`;
			}
		);
		code = code.replace(
			/(import\s*\(\s*["'])(\.(?:\/|\.\.\/)[^"'?#]+?)(["']\s*\))/g,
			(whole, a, p, b) => {
				if (/\.[a-zA-Z0-9]+$/.test(p)) return whole;
				return `${a}${p}${outExt}${b}`;
			}
		);
	}

	return code;
}

/** ---------------------------
 *  Post-process plugin:
 *   - read all output *.js
 *   - inline ReactiveFlags constants
 *   - remove flags.* files
 *   - rewrite internal imports
 *   - enum transform (best-effort)
 *   - rename to *.mjs / *.cjs
 * -------------------------- */
function postProcessPlugin({ format }) {
	const outExt = format === "cjs" ? ".cjs" : ".mjs";

	return {
		name: "post-process",
		setup(build) {
			build.onEnd(async (result) => {
				if (!result.metafile) return;

				const outFiles = Object.keys(result.metafile.outputs).filter((p) => p.endsWith(".js"));

				await Promise.all(
					outFiles.map(async (jsPath) => {
						let code = await fs.readFile(jsPath, "utf8");

						code = inlineReactiveFlags(code);
						code = rewriteInternalImports(code, { format, outExt });
						code = transformEnumsToConst(code);

						const finalPath = jsPath.slice(0, -".js".length) + outExt;
						await fs.writeFile(finalPath, code, "utf8");
						await fs.unlink(jsPath);
					})
				);


				// More reliable way: check output directory
				const firstOutFile = Object.keys(result.metafile.outputs)[0];
				const outdir = dirname(firstOutFile);

				const flagsPath = join(outdir, `flags.${outExt}`);

				try {
					await fs.unlink(flagsPath);
				} catch (e) {
					// File might not exist, ignore
				}
			});
		},
	};
}

/** ---------------------------
 *  Build JS (esbuild)
 * -------------------------- */
async function buildJs({ format, outdir }) {
	const result = await esbuild.build({
		entryPoints,
		outdir,
		bundle: false, // tsc-like emit
		format,        // 'cjs' | 'esm'
		platform: "node",
		target: "es2020",
		legalComments: "none",
		sourcemap: false,
		tsconfig: join(__dirname, "tsconfig.json"),
		metafile: true,
		plugins: [postProcessPlugin({ format })],
		logLevel: "silent",
	});

	// Fail fast on build errors
	if (result.errors?.length) process.exit(1);
}

/** ---------------------------
 *  Run
 * -------------------------- */
emitTypes();
await buildJs({ format: "cjs", outdir: "cjs" });
await buildJs({ format: "esm", outdir: "esm" });
