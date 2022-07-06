import { z } from 'zod';

z.object({
  enabled: z.boolean({
    description: `Enable or disable Renovate bot.`,
  }),
});
