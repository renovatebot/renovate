import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  vulnerabilityBranchDepName: {
    description:
      'Use depName instead of depNameSanitized in remediation branch names',
    vulnerabilityAlerts: {
      branchTopic: `{{{datasource}}}-{{{depName}}}-vulnerability`,
    },
  },
};
