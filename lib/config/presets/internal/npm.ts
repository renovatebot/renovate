import { _ } from '../../../i18n';
import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  unpublishSafe: {
    description: _(
      'Wait until the npm package is three days old before raising the update, this prevents npm unpublishing a package you already upgraded to.'
    ),
    npm: {
      minimumReleaseAge: '3 days',
    },
  },
};
