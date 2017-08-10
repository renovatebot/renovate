module.exports = {
  allJest: {
    description: ['All jest packages'],
    packagePatterns: ['jest'],
  },
  groupJest: {
    description: ['Group together jest packages'],
    presets: ['allJest'],
    groupName: 'jest',
  },
  allAngular: {
    description: ['All angular.js packages'],
    packageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  groupAngular: {
    description: ['Group together angular.js packages'],
    presets: ['allAngular'],
    groupName: 'angular.js',
  },
  allMapbox: {
    description: ['All mapbox-related packages'],
    packagePatterns: ['^(leaflet|mapbox)'],
  },
  groupMapbox: {
    description: ['Group together mapbox packages'],
    presets: ['allMapbox'],
    groupName: 'mapbox',
  },
  allEslint: {
    description: ['All eslint packages'],
    packagePatterns: ['^eslint'],
  },
  groupEslint: {
    description: ['Group all package starting with eslint'],
    presets: ['allEslint'],
    groupName: 'eslint',
  },
  allStyleLint: {
    description: ['All stylelint packages'],
    packagePatterns: ['^stylelint'],
  },
  groupStyleLint: {
    description: ['Group all stylelint-prefixed packages'],
    presets: ['allStyleLint'],
    groupName: 'stylelint',
  },
  allRemark: {
    description: ['All remark packages'],
    packagePatterns: ['^remark'],
  },
  groupRemark: {
    presets: ['allRemark'],
    groupName: 'remark',
  },
  allLinters: {
    presets: ['allEslint', 'allStyleLint', 'allRemark'],
    description: ['All lint-related packages'],
  },
  automergeLinters: {
    presets: ['allLinters'],
    automerge: 'any',
  },
};
