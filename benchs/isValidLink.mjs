import { bench, boxplot, run } from 'mitata';
import { signal, computed, effect } from '../esm/index.mjs';

boxplot(() => {
	bench('isValidLink: deep dependency chain', function* (state) {
		const depth = state.get('depth');
		const width = state.get('width');
		const src = signal(0);

		// Create a deep dependency chain
		let current = src;
		for (let i = 0; i < depth; i++) {
			const prev = current;
			current = computed(() => prev() + 1);
		}

		// Create multiple effects that trigger validation
		const effects = [];
		for (let i = 0; i < width; i++) {
			const prevCurrent = current;
			effects.push(effect(() => prevCurrent()));
		}

		yield () => src(src() + 1);
	})
		.args('depth', [10, 50, 100])
		.args('width', [10, 50, 100]);
});

run({ format: 'markdown' });
