/**
 * | Flag            | Категорія    | Хто ставить                          | Хто знімає             | Інваріант / сенс                                |
 * | --------------- | ------------ | ------------------------------------ | ---------------------- | ----------------------------------------------- |
 * | `Mutable`       | type         | create                               | never                  | Нода має deps/subs і може бути computed/derived |
 * | `Watching`      | observers    | runtime                              | runtime                | При зміні стану викликаємо `notify(sub)`        |
 * | `Pending`       | scheduling   | `propagate`, `checkDirty`            | `checkDirty`           | Ноду треба *пройти* (maybe recompute)           |
 * | `Dirty`         | invalidation | `shallowPropagate`, propagate        | `update` або recompute | Нода точно зміниться при recompute              |
 * | `RecursedCheck` | recursion    | ??? (де самечастина guard) | ???                    | “помітка участі в рекурсивній валідації”        |
 * | `Recursed`      | recursion    | `propagate`                          | `propagate/checkDirty` | “цей sub пройшов через рекурсивний шлях”        |
 * 
 */
export const ReactiveFlags = {
	None: 0,
	Mutable: 1 << 0,
	Watching: 1 << 1,
	RecursedCheck: 1 << 2,
	Recursed: 1 << 3,
	Dirty: 1 << 4,
	Pending: 1 << 5,
} as const;

export type ReactiveFlags =
	(typeof ReactiveFlags)[keyof typeof ReactiveFlags];
