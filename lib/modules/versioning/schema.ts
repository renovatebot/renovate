import { z } from 'zod';
import api from './api';

export const Versioning = z.string().transform((key, ctx) => {
  const versioning = api.get(key);
  if (!versioning) {
    ctx.addIssue({ code: 'custom', message: 'Versioning not found' });
    return z.NEVER;
  }

  return versioning;
});
