import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  replacements: {
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['jade'],
        replacementName: 'pug',
        replacementVersion: '2.0.0',
        commitMessageAction: 'Replace',
        commitMessageExtra:
          'with {{newName}} {{#if isMajor}}v{{{newMajor}}}{{else}}{{#if isSingleVersion}}v{{{newVersion}}}{{else}}{{{newValue}}}{{/if}}{{/if}}',
      },
    ],
  },
};
