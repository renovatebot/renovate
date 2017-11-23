module.exports = {
  token: 'abcdefg',
  logLevel: 'error',
  repositories: [
    'singapore/lint-condo',
    {
      repository: 'renovateapp/renovate',
      packageFiles: ['package2.json'],
    },
    {
      repository: 'renovateapp/renovate',
      packageFiles: [
        {
          packageFile: 'package.json',
          labels: ['a'],
        },
      ],
    },
  ],
};
