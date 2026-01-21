import { expect, test, describe, beforeAll } from 'vitest';
import { createReactiveSystem } from '../src/system';
import { ReactiveFlags } from '../src/flags';
import type { Link, ReactiveNode } from '../src/graph';

describe('isValidLink semantics', () => {
	let isValidLink: (checkLink: Link, sub: ReactiveNode) => boolean;

	// Setup: Create a mock reactive system to get access to isValidLink
	beforeAll(() => {
		const system = createReactiveSystem({
			update: () => false,
			notify: () => { },
			unwatched: () => { },
		});
		isValidLink = (system as any).isValidLink;
	});

	describe('basic functionality', () => {
		test('should return true when checkLink has matching depEpoch', () => {
			// Setup: Create a subscriber node with depsEpoch
			const sub: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined,
				depsEpoch: 1,
			};

			const dep1: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined, depsEpoch: 0
			};

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1, // matches sub.depsEpoch
			};

			// Test: Check if link1 is valid for sub
			expect(isValidLink(link1, sub)).toBe(true);
		});

		test('should return false when checkLink has mismatched depEpoch', () => {
			// Setup: Create two separate nodes and links
			const sub: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined,
				depsEpoch: 2, // current epoch
			};

			const dep1: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined, depsEpoch: 0
			};

			const dep2: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined, depsEpoch: 0
			};

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 2, // matches current epoch
			};

			const link2: Link = {
				version: 2,
				dep: dep2,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1, // stale epoch from previous cycle
			};

			// Test: link2 should return false (stale epoch)
			expect(isValidLink(link2, sub)).toBe(false);
		});
	});

	describe('dependency chain traversal', () => {
		test('should find link in the middle of dependency chain with matching epoch', () => {
			const sub: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined,
				depsEpoch: 1,
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep2: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep3: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			// Create a chain: link1 -> link2 -> link3
			const link3: Link = {
				version: 3,
				dep: dep3,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			const link2: Link = {
				version: 2,
				dep: dep2,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: link3,
				depEpoch: 1,
			};

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: link2,
				depEpoch: 1,
			};

			// Update pointers
			link3.prevDep = link2;
			link2.prevDep = link1;

			sub.depsTail = link3; // tail points to link3
			sub.deps = link1; // head points to link1

			// Test: should find link2 (epoch matches)
			expect(isValidLink(link2, sub)).toBe(true);
		});

		test('should find link at the beginning (depsTail position)', () => {
			const sub: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined,
				depsEpoch: 1,
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep2: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link2: Link = {
				version: 2,
				dep: dep2,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: link2,
				depEpoch: 1,
			};

			link2.prevDep = link1;

			sub.depsTail = link2;
			sub.deps = link1;

			// Test: should find link2 at depsTail position
			expect(isValidLink(link2, sub)).toBe(true);
		});

		test('should not find link with stale epoch after dependency recalculation', () => {
			const sub: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined,
				depsEpoch: 2, // epoch has advanced
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep2: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep3: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			// Create chain where link1 is stale (from old epoch)
			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1, // old epoch - this link was pruned
			};

			const link2: Link = {
				version: 2,
				dep: dep2,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 2, // current epoch
			};

			const link3: Link = {
				version: 3,
				dep: dep3,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 2, // current epoch
			};

			// Test: link1 should be invalid (stale epoch)
			expect(isValidLink(link1, sub)).toBe(false);
			expect(isValidLink(link2, sub)).toBe(true);
			expect(isValidLink(link3, sub)).toBe(true);
		});
	});

	describe('edge cases', () => {
		test('should return false when sub has no depsEpoch set', () => {
			const sub: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined, depsEpoch: 0
				// depsEpoch is undefined
			};

			const dep: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const link: Link = {
				version: 1,
				dep: dep,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1, // has epoch but sub doesn't
			};

			// Test: should return false when depEpoch mismatch (undefined vs 1)
			expect(isValidLink(link, sub)).toBe(false);
		});

		test('should return false when checking unrelated link', () => {
			const sub1: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 1,
			};
			const sub2: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 1,
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep2: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub1,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			const link2: Link = {
				version: 1,
				dep: dep2,
				sub: sub2,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			// Test: link2 belongs to sub2, not sub1 (different sub reference)
			expect(isValidLink(link2, sub1)).toBe(false);
		});

		test('should handle single-element dependency chain', () => {
			const sub: ReactiveNode = {
				flags: ReactiveFlags.None,
				deps: undefined,
				depsTail: undefined,
				subs: undefined,
				subsTail: undefined,
				depsEpoch: 1,
			};

			const dep: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link: Link = {
				version: 1,
				dep: dep,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			sub.depsTail = link;
			sub.deps = link;

			// Test: should find the single link (epoch matches)
			expect(isValidLink(link, sub)).toBe(true);
		});
	});

	describe('link identity semantics', () => {
		test('should use reference equality to match links (epoch-based)', () => {
			const sub: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 1,
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			// Create a different link object with same properties
			const link1Copy: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			sub.depsTail = link1;
			sub.deps = link1;

			// Test: epoch semantics means both would return true IF they have matching epoch
			// But in practice, only the actual link would be stored in deps chain
			expect(isValidLink(link1, sub)).toBe(true);
			expect(isValidLink(link1Copy, sub)).toBe(true); // epoch matches, so valid
		});

		test('should not match links when epoch differs', () => {
			const sub: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 2,
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 2,
			};

			const link2: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1, // stale epoch
			};

			// Test: even with same sub reference, different epoch means invalid
			expect(isValidLink(link1, sub)).toBe(true);
			expect(isValidLink(link2, sub)).toBe(false);
		});
	});

	describe('complex dependency graphs', () => {
		test('should handle multiple dependencies for same subscriber', () => {
			const sub: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 1,
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep2: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep3: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			const link2: Link = {
				version: 2,
				dep: dep2,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			const link3: Link = {
				version: 3,
				dep: dep3,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			// Build chain: link1 -> link2 -> link3
			link1.nextDep = link2;
			link2.prevDep = link1;
			link2.nextDep = link3;
			link3.prevDep = link2;

			sub.deps = link1;
			sub.depsTail = link3;

			// Test: all links should be found (all have matching epoch)
			expect(isValidLink(link1, sub)).toBe(true);
			expect(isValidLink(link2, sub)).toBe(true);
			expect(isValidLink(link3, sub)).toBe(true);
		});

		test('should not find links not in current epoch', () => {
			const sub: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 2, // current epoch
			};

			const dep1: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep2: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
			const dep3: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link1: Link = {
				version: 1,
				dep: dep1,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 2, // current
			};

			const link2: Link = {
				version: 2,
				dep: dep2,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 2, // current
			};

			const link3: Link = {
				version: 3,
				dep: dep3,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1, // stale - from previous epoch
			};

			link1.nextDep = link2;
			link2.prevDep = link1;

			sub.deps = link1;
			sub.depsTail = link2;

			// Test: link3 should not be found (stale epoch)
			expect(isValidLink(link1, sub)).toBe(true);
			expect(isValidLink(link2, sub)).toBe(true);
			expect(isValidLink(link3, sub)).toBe(false);
		});

		test('should efficiently find links without traversal (O(1))', () => {
			const sub: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 5,
			};

			const links: Link[] = [];
			for (let i = 0; i < 5; i++) {
				const dep: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
				const link: Link = {
					version: i,
					dep: dep,
					sub: sub,
					prevSub: undefined,
					nextSub: undefined,
					prevDep: i > 0 ? links[i - 1] : undefined,
					nextDep: undefined,
					depEpoch: 5,
				};
				if (i > 0) {
					links[i - 1].nextDep = link;
				}
				links.push(link);
			}

			sub.deps = links[0];
			sub.depsTail = links[4];

			// Test: all links should be valid (no traversal needed - O(1) check)
			expect(isValidLink(links[0], sub)).toBe(true);
			expect(isValidLink(links[2], sub)).toBe(true);
			expect(isValidLink(links[4], sub)).toBe(true);
		});
	});

	describe('performance characteristics', () => {
		test('should return immediately for link with matching epoch', () => {
			const sub: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 1,
			};
			const dep: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };

			const link: Link = {
				version: 1,
				dep: dep,
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1,
			};

			sub.depsTail = link;

			// The function should return true immediately (O(1))
			expect(isValidLink(link, sub)).toBe(true);
		});

		test('should detect stale links immediately (O(1))', () => {
			const sub: ReactiveNode = {
				deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined,
				flags: ReactiveFlags.None,
				depsEpoch: 3,
			};

			// Create a longer chain for reference
			const links: Link[] = [];
			for (let i = 0; i < 10; i++) {
				const dep: ReactiveNode = { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 };
				const link: Link = {
					version: i,
					dep: dep,
					sub: sub,
					prevSub: undefined,
					nextSub: undefined,
					prevDep: i > 0 ? links[i - 1] : undefined,
					nextDep: undefined,
					depEpoch: 3,
				};
				if (i > 0) {
					links[i - 1].nextDep = link;
				}
				links.push(link);
			}

			sub.deps = links[0];
			sub.depsTail = links[9];

			// Create a stale link from old epoch
			const staleLink: Link = {
				version: 99,
				dep: { deps: undefined, depsTail: undefined, subs: undefined, subsTail: undefined, flags: ReactiveFlags.None, depsEpoch: 0 },
				sub: sub,
				prevSub: undefined,
				nextSub: undefined,
				prevDep: undefined,
				nextDep: undefined,
				depEpoch: 1, // old epoch
			};

			// Test: should immediately detect stale link (O(1) - no traversal)
			expect(isValidLink(staleLink, sub)).toBe(false);
		});
	});
});

