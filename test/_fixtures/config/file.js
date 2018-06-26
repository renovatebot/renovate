module.exports = {
  token: 'abcdefg',
  logLevel: 'error',
  repositories: [
    'singapore/lint-condo',
    {
      repository: 'renovatebot/renovate',
      packageFiles: ['package2.json'],
    },
    {
      repository: 'renovatebot/renovate',
      packageFiles: [
        {
          packageFile: 'package.json',
          labels: ['a'],
        },
      ],
    },
  ],
};
