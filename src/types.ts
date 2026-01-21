import { ReactiveNode } from "./graph";

export interface EffectNode extends ReactiveNode {
	fn(): void;
}

export interface ComputedNode<T = any> extends ReactiveNode {
	value: T | undefined;
	getter: (previousValue?: T) => T;
}

export interface SignalNode<T = any> extends ReactiveNode {
	currentValue: T;
	pendingValue: T;
}