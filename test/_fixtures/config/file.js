module.exports = {
  token: 'abcdefg',
  logLevel: 'verbose',
  repositories: [
    'singapore/lint-condo',
    {
      repository: 'singapore/renovate',
      packageFiles: ['package2.json'],
    },
    {
      repository: 'singapore/renovate',
      packageFiles: [
        {
          fileName: 'package.json',
          labels: ['a'],
        },
      ],
    },
  ],
};
