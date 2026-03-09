import { z } from 'zod/v3';
import { regEx } from '../../../util/regex.ts';

export const XPKG = z.object({
  apiVersion: z.string().regex(regEx(/^pkg\.crossplane\.io\//)),
  kind: z.enum(['Provider', 'Configuration', 'Function']),
  spec: z.object({
    package: z.string(),
  }),
});

export type XPKG = z.infer<typeof XPKG>;
