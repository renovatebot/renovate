import { z } from 'zod/v4';
import { regEx } from '../regex.ts';

export const LongCommitSha = z
  .string()
  .regex(regEx(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/))
  .brand('LongCommitSha');
export type LongCommitSha = z.infer<typeof LongCommitSha>;

export const ShortCommitSha = z
  .string()
  .regex(regEx(/^[a-f0-9]{6,7}$/))
  .brand('ShortCommitSha');
export type ShortCommitSha = z.infer<typeof ShortCommitSha>;

export function isLongCommitSha(value: unknown): value is LongCommitSha {
  return LongCommitSha.safeParse(value).success;
}

export function isShortCommitSha(value: unknown): value is ShortCommitSha {
  return ShortCommitSha.safeParse(value).success;
}

export function toLongCommitSha(value: unknown): LongCommitSha {
  if (!isLongCommitSha(value)) {
    throw new Error(`Invalid long commit SHA: ${String(value)}`);
  }
  return value;
}
