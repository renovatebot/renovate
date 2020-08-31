import merge from 'deepmerge';
import * as t from 'zod';
import { logger } from '../logger';
import { BranchConfigCoerced } from './common';

const branchConfig = t
  .object({
    recreateClosed: t.boolean().nullable(),
  })
  .nonstrict();

const defaults = {
  recreateClosed: null,
};

export function coerceBranchConfig(config: unknown): BranchConfigCoerced {
  const merged = merge(defaults, config) as BranchConfigCoerced;
  try {
    branchConfig.parse(merged);
  } catch (err) {
    logger.debug({ err }, 'Coercion error');
  }
  return merged;
}
