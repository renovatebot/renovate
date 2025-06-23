import replacementGroupsJson from '../../../data/replacements.json';
import type { Preset } from '../types';
import type { PresetTemplate, Replacement } from './auto-generate-replacements';
import { addPresets } from './auto-generate-replacements';

const { $schema, ...replacementPresets } = replacementGroupsJson;

/* eslint sort-keys: ["error", "asc", {"caseSensitive": false, "natural": true}] */
export const presets: Record<string, Preset> = replacementPresets;

const muiReplacement: Replacement[] = [
  [['@material-ui/codemod'], '@mui/codemod'],
  [['@material-ui/core'], '@mui/material'],
  [['@material-ui/icons'], '@mui/icons-material'],
  [['@material-ui/lab'], '@mui/lab'],
  [['@material-ui/private-theming'], '@mui/private-theming'],
  [['@material-ui/styled-engine'], '@mui/styled-engine'],
  [['@material-ui/styled-engine-sc'], '@mui/styled-engine-sc'],
  [['@material-ui/styles'], '@mui/styles'],
  [['@material-ui/system'], '@mui/system'],
  [['@material-ui/types'], '@mui/types'],
  [['@material-ui/unstyled'], '@mui/core'],
];

const mui: PresetTemplate = {
  description:
    'The `material-ui` monorepo org was renamed from `@material-ui` to `@mui`.',
  packageRules: [
    {
      matchCurrentVersion: '>=4.0.0 <5.0.0',
      matchDatasources: ['npm'],
      replacements: muiReplacement,
      replacementVersion: '5.0.0',
    },
  ],
  title: 'material-ui-to-mui',
};

const messageFormat: PresetTemplate = {
  description:
    'The `messageformat` monorepo package naming scheme changed from `messageFormat-{{package}}` to `@messageformat/{{package}}`.',
  packageRules: [
    {
      matchCurrentVersion: '>=2.0.0 <3.0.0',
      matchDatasources: ['npm'],
      replacements: [
        [['messageformat-cli'], '@messageformat/cli'],
        [['messageformat'], '@messageformat/core'],
      ],
      replacementVersion: '3.0.0',
    },
    {
      matchCurrentVersion: '>=0.4.0 <1.0.0',
      matchDatasources: ['npm'],
      replacements: [
        [['messageformat-convert'], '@messageformat/convert'],
        [['react-message-context'], '@messageformat/react'],
      ],
      replacementVersion: '1.0.0',
    },
    {
      matchCurrentVersion: '>=4.0.0 <5.0.0',
      matchDatasources: ['npm'],
      replacements: [[['messageformat-parser'], '@messageformat/parser']],
      replacementVersion: '5.0.0',
    },
  ],
  title: 'messageFormat-to-scoped',
};

addPresets(presets, messageFormat, mui);
