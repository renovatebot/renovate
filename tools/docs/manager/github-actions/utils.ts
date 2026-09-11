import { z } from 'zod/v4';
import type { CommunityActionConfig } from '../../../../lib/modules/manager/github-actions/types.ts';

export function getWithSchemaFields(
  schema: CommunityActionConfig['withSchema'],
): string[] {
  if (!schema) {
    return ['version'];
  }
  // `z.object({...}).transform(...)` produces a ZodPipe in Zod v4, where
  // `def.in` is the source ZodObject. Walk through any pipes until we hit it.
  let current: z.ZodType = schema;
  while ('in' in current.def) {
    current = current.def.in as z.ZodType;
  }
  if (current instanceof z.ZodObject) {
    return Object.keys(current.shape);
  }
  return ['version'];
}

export function determineDependencyToUpdate({
  depName,
  packageName,
}: CommunityActionConfig): string {
  if (!depName && !packageName) {
    // some actions determine the depName and packageName dynamically
    return '(determined from `with` input(s))';
  }

  return `[\`${depName ?? packageName}\`](https://github.com/${packageName})`;
}
