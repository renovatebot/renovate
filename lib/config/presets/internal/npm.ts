import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  unpublishSafe: {
    description:
      'Wait until the npm package is three days old before raising the update, this prevents npm unpublishing a package you already upgraded to.',
    npm: {
      stabilityDays: 3,
    },
  },
};
