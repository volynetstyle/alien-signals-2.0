import { ReactiveFlags } from "./flags";
import type { EffectNode, SignalNode, ComputedNode } from './types.js';

export function createSignalNode(initialValue: unknown): SignalNode {
	return {
		deps: undefined,
		depsTail: undefined,
		subs: undefined,
		subsTail: undefined,
		flags: ReactiveFlags.Mutable,
		depsEpoch: 0,
		currentValue: initialValue,
		pendingValue: initialValue,
	};
}

export function createComputedNode(getter: (prev?: unknown) => unknown): ComputedNode {
	return {
		deps: undefined,
		depsTail: undefined,
		subs: undefined,
		subsTail: undefined,
		flags: ReactiveFlags.None,
		depsEpoch: 0,
		value: undefined,
		getter,
	};
}

export function createEffectNode(fn: () => void): EffectNode {
	return {
		deps: undefined,
		depsTail: undefined,
		subs: undefined,
		subsTail: undefined,
		flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,
		depsEpoch: 0,
		fn,
	};
}
