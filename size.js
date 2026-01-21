import './build.mjs';
import { build } from 'rolldown';

const files = ['esm/index.mjs', 'esm/system.mjs', 'cjs/index.cjs', 'cjs/system.cjs'];

for (const file of files) {
	build({
		input: file, output: { minify: true }, write: false, treeshake: true
	}).then(built => {
		console.log(`${file}: ${(built.output[0].code.length / 1024).toFixed(2)} KB`);
	});
}