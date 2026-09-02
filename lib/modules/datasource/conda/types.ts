import type { Release } from '../types.ts';

/** The releases of every package in one channel subdir, keyed by package name. */
export type RepodataIndex = Map<string, Map<string, Release>>;
