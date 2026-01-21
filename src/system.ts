import { ReactiveFlags } from "./flags";
import type { ReactiveNode, Link } from "./graph";

interface Stack<T> {
	value: T;
	prev: Stack<T> | undefined;
}

export function createReactiveSystem({
	update,
	notify,
	unwatched,
}: {
	update(sub: ReactiveNode): boolean;
	notify(sub: ReactiveNode): void;
	unwatched(sub: ReactiveNode): void;
}) {
	return {
		link,
		unlink,
		propagate,
		checkDirty,
		shallowPropagate,
		isValidLink,
	};

	function link(dep: ReactiveNode, sub: ReactiveNode, version: number): void {
		const tailDep = sub.depsTail;
		if (tailDep !== undefined && tailDep.dep === dep) return;

		const tailSub = dep.subsTail;
		if (tailSub !== undefined && tailSub.version === version && tailSub.sub === sub) return;

		// (keeps your original optimisation idea, but avoids extra conditionals)
		const headDep = sub.deps;
		let nextDep: Link | undefined;

		if (tailDep !== undefined) {
			nextDep = tailDep.nextDep; // likely the cursor position

			if (nextDep !== undefined && nextDep.dep === dep) {
				nextDep.version = version;
				nextDep.depEpoch = sub.depsEpoch;
				sub.depsTail = nextDep;
				return;
			}
		} else {
			// no deps yet => cursor = head
			nextDep = headDep;
			if (nextDep !== undefined && nextDep.dep === dep) {
				nextDep.version = version;
				nextDep.depEpoch = sub.depsEpoch;
				sub.depsTail = nextDep;
				return;
			}
		}

		const newLink: Link = {
			dep,
			sub,
			prevDep: tailDep,
			nextDep: undefined,
			prevSub: tailSub,
			nextSub: undefined,
			version,
			depEpoch: sub.depsEpoch,
		};

		if (tailDep !== undefined) {
			tailDep.nextDep = newLink;
		} else {
			sub.deps = newLink;
		}
		sub.depsTail = newLink;

		if (tailSub !== undefined) {
			tailSub.nextSub = newLink;
		} else {
			dep.subs = newLink;
		}
		dep.subsTail = newLink;
	}

	function unlink(link: Link, sub: ReactiveNode = link.sub): Link | undefined {
		const dep = link.dep;

		const nextDep = link.nextDep;
		const prevDep = link.prevDep;

		const nextSub = link.nextSub;
		const prevSub = link.prevSub;

		// ---- detach from sub.deps chain
		if (prevDep !== undefined) {
			prevDep.nextDep = nextDep;
		} else {
			sub.deps = nextDep;
		}

		if (nextDep !== undefined) {
			nextDep.prevDep = prevDep;
		} else {
			sub.depsTail = prevDep;
		}

		// ---- detach from dep.subs chain
		if (prevSub !== undefined) {
			prevSub.nextSub = nextSub;
		} else {
			dep.subs = nextSub;
			if (nextSub === undefined) {
				// dep now has no subscribers
				dep.subsTail = undefined;
				unwatched(dep);
				return nextDep;
			}
		}

		if (nextSub !== undefined) {
			nextSub.prevSub = prevSub;
		} else {
			dep.subsTail = prevSub;
		}

		return nextDep;
	}


	function propagate(link: Link): void {
		let next = link.nextSub;
		let stack: Stack<Link | undefined> | undefined;

		top: do {
			const sub = link.sub;
			let flags = sub.flags;

			if (!(flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed | ReactiveFlags.Dirty | ReactiveFlags.Pending))) {
				sub.flags = flags | ReactiveFlags.Pending;
			} else if (!(flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed))) {
				flags = ReactiveFlags.None;
			} else if (!(flags & ReactiveFlags.RecursedCheck)) {
				sub.flags = (flags & ~ReactiveFlags.Recursed) | ReactiveFlags.Pending;
			} else if (!(flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) && isValidLink(link, sub)) {
				sub.flags = flags | (ReactiveFlags.Recursed | ReactiveFlags.Pending);
				flags &= ReactiveFlags.Mutable;
			} else {
				flags = ReactiveFlags.None;
			}

			if (flags & ReactiveFlags.Watching) {
				notify(sub);
			}

			if (flags & ReactiveFlags.Mutable) {
				const subSubs = sub.subs;
				if (subSubs !== undefined) {
					const nextSub = (link = subSubs).nextSub;
					if (nextSub !== undefined) {
						stack = { value: next, prev: stack };
						next = nextSub;
					}
					continue;
				}
			}

			if ((link = next!) !== undefined) {
				next = link.nextSub;
				continue;
			}

			while (stack !== undefined) {
				link = stack.value!;
				stack = stack.prev;
				if (link !== undefined) {
					next = link.nextSub;
					continue top;
				}
			}

			break;
		} while (true);
	}

	function checkDirty(link: Link, sub: ReactiveNode): boolean {
		let stack: Stack<Link> | undefined;
		let checkDepth = 0;
		let dirty = false;

		top: do {
			const dep = link.dep;
			const flags = dep.flags;

			if (sub.flags & ReactiveFlags.Dirty) {
				dirty = true;
			} else if ((flags & (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) === (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) {
				if (update(dep)) {
					const subs = dep.subs!;
					if (subs.nextSub !== undefined) {
						shallowPropagate(subs);
					}
					dirty = true;
				}
			} else if ((flags & (ReactiveFlags.Mutable | ReactiveFlags.Pending)) === (ReactiveFlags.Mutable | ReactiveFlags.Pending)) {
				if (link.nextSub !== undefined || link.prevSub !== undefined) {
					stack = { value: link, prev: stack };
				}
				link = dep.deps!;
				sub = dep;
				++checkDepth;
				continue;
			}

			if (!dirty) {
				const nextDep = link.nextDep;
				if (nextDep !== undefined) {
					link = nextDep;
					continue;
				}
			}

			while (checkDepth--) {
				const firstSub = sub.subs!;
				const hasMultipleSubs = firstSub.nextSub !== undefined;
				if (hasMultipleSubs) {
					link = stack!.value;
					stack = stack!.prev;
				} else {
					link = firstSub;
				}
				if (dirty) {
					if (update(sub)) {
						if (hasMultipleSubs) {
							shallowPropagate(firstSub);
						}
						sub = link.sub;
						continue;
					}
					dirty = false;
				} else {
					sub.flags &= ~ReactiveFlags.Pending;
				}
				sub = link.sub;
				const nextDep = link.nextDep;
				if (nextDep !== undefined) {
					link = nextDep;
					continue top;
				}
			}

			return dirty;
		} while (true);
	}

	function shallowPropagate(link: Link): void {
		do {
			const sub = link.sub;
			const flags = sub.flags;
			if ((flags & (ReactiveFlags.Pending | ReactiveFlags.Dirty)) === ReactiveFlags.Pending) {
				sub.flags = flags | ReactiveFlags.Dirty;
				if ((flags & (ReactiveFlags.Watching | ReactiveFlags.RecursedCheck)) === ReactiveFlags.Watching) {
					notify(sub);
				}
			}
		} while ((link = link.nextSub!) !== undefined);
	}

	function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
		return checkLink.sub === sub && checkLink.depEpoch === sub.depsEpoch;
	}
}
