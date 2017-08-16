module.exports = {
  angularJs: {
    description: 'All angular.js packages',
    packageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  mapbox: {
    description: 'All mapbox-related packages',
    packagePatterns: ['^(leaflet|mapbox)'],
  },
  eslint: {
    description: 'All eslint packages',
    packagePatterns: ['^eslint'],
  },
  stylelint: {
    description: 'All stylelint packages',
    packagePatterns: ['^stylelint'],
  },
  linters: {
    description: 'All lint-related packages',
    extends: ['packages:allEslint', 'packages:allStyleLint'],
    packageNames: ['remark-lint'],
  },
};
