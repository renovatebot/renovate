// ── “Exact Object” helper: no more and no fewer keys than expected ──────────
export type Exact<S, A extends S> =
  // keep the legal properties
  A & Record<Exclude<keyof A, keyof S>, never>; // …and forbid anything that A has but S hasn’t
