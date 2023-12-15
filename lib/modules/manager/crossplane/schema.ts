import { z } from 'zod';

export const XPKGSchema = z.object({
  apiVersion: z.string().regex(/^pkg\.crossplane\.io\//),
  kind: z.enum(['Provider', 'Configuration', 'Function']),
  spec: z.object({
    package: z.string(),
  }),
});

export type XPKG = z.infer<typeof XPKGSchema>;
