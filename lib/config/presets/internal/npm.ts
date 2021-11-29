import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  unpublishSafe: {
    description:
      'Set a status check pending for 3 days from release timestamp to guard against npm unpublishing',
    npm: {
      stabilityDays: 3,
    },
  },
};
