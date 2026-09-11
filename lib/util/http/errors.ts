// v8 ignore file -- trivial error subclass for zod Result.wrap, no logic to cover
// required for zod type safety with `Result.wrap`
export class EmptyResultError extends Error {}
