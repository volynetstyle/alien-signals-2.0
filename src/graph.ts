import { ReactiveFlags } from "./flags";

export interface Link {
	dep: ReactiveNode;
	sub: ReactiveNode;

	prevSub: Link | undefined;
	nextSub: Link | undefined;
	prevDep: Link | undefined;
	nextDep: Link | undefined;

	version: number;
	depEpoch: number;
}

export interface ReactiveNode {
	deps: Link | undefined;
	depsTail: Link | undefined;

	subs: Link | undefined;
	subsTail: Link | undefined;

	flags: ReactiveFlags;

	depsEpoch: number;
}
