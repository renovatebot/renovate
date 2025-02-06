import { z } from 'zod';

export const UserSchema = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
});
