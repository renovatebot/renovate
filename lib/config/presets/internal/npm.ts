import { Preset } from '../common';

export const presets: Record<string, Preset> = {
  unpublishSafe: {
    description:
      'Set a status check to warn when upgrades <  72 hours old might get unpublished',
    npm: {
      stabilityDays: 3,
      prNotPendingHours: 73,
    },
  },
};
