/**
 * The state a pull request can actually be in.
 */
export type PrState = 'open' | 'closed' | 'merged';

/**
 * The states accepted when searching for pull requests, i.e. the actual states
 * plus the pseudo-states `all` and `!open`.
 */
export type PrFilterState = PrState | 'all' | '!open';
