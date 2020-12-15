const { groups: presetGroups } = require('../../dist/config/presets/internal');
const { getManagerList } = require('../../dist/manager');

module.exports = {
  someSidebar: [
    'home',
    {
      'Getting Started': [
        'install-github-app',
        'install-gitlab-app',
        'configure-renovate',
        'private-modules',
        'reconfigure-renovate',
      ],
    },
    'configuration-options',
    'self-hosted-configuration',
    {
      'Renovate Modules': [
        'modules/platform',
        'modules/manager',
        'modules/datasource',
        'modules/versioning',
      ],
    },
    'config-presets',
    {
      'Language Support': [
        'bazel',
        'docker',
        'golang',
        'java',
        'javascript',
        'node',
        'nuget',
        'php',
        'python',
        'ruby',
      ],
    },
    {
      'Deep Dives': [
        'dependency-pinning',
        'configuration-templates',
        'updating-rebasing',
        'semantic-commits',
        'noise-reduction',
      ],
    },
    {
      'Included Presets': [
        ...Object.keys(presetGroups).map((n) => `presets-${n}`),
      ],
    },
    {
      'All Other': ['templates', 'faq'],
    },
  ],
  managerSidebar: [
    {
      type: 'ref',
      id: 'modules/manager',
    },
    ...getManagerList().map((m) => `modules/manager/${m}`),
  ],
};
