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
export const enum ReactiveFlags {
	None = 0,
	Mutable,
	Watching,
	RecursedCheck,
	Recursed,
	Dirty,
	Pending,
}
