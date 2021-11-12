import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  all: {
    description: 'All replacements',
    extends: ['replacements:jade-to-pug'],
  },
  'jade-to-pug': {
    description: 'Jade was renamed to Pug',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['jade'],
        replacementName: 'pug',
        replacementVersion: '2.0.0',
      },
    ],
  },
};
