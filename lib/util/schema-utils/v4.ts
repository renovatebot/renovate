import { z } from 'zod/v4';

export const Json = z.string().transform((str, ctx): unknown => {
  try {
    return JSON.parse(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON' });
    return z.NEVER;
  }
});
