module.exports = {
  allJest: {
    description: ['All jest packages'],
    packagePatterns: ['jest'],
  },
  groupJest: {
    description: ['Group together jest packages'],
    packageRules: [
      {
        presets: ['allJest'],
        groupName: 'jest',
      },
    ],
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
    packageRules: [
      {
        presets: ['allAngular'],
        groupName: 'angular.js',
      },
    ],
  },
  allMapbox: {
    description: ['All mapbox-related packages'],
    packagePatterns: ['^(leaflet|mapbox)'],
  },
  groupMapbox: {
    description: ['Group together mapbox packages'],
    packageRules: [
      {
        presets: ['allMapbox'],
        groupName: 'mapbox',
      },
    ],
  },
  allEslint: {
    description: ['All eslint packages'],
    packagePatterns: ['^eslint'],
  },
  groupEslint: {
    description: ['Group all package starting with eslint'],
    packageRules: [
      {
        presets: ['allEslint'],
        groupName: 'eslint',
      },
    ],
  },
  allStylelint: {
    description: ['All stylelint packages'],
    packagePatterns: ['^stylelint'],
  },
  groupStylelint: {
    description: ['Group all stylelint-prefixed packages'],
    packageRules: [
      {
        presets: ['allStylelint'],
        groupName: 'stylelint',
      },
    ],
  },
  allRemark: {
    description: ['All remark packages'],
    packagePatterns: ['^remark'],
  },
  groupRemark: {
    packageRules: [
      {
        presets: ['allRemark'],
        groupName: 'remark',
      },
    ],
  },
  allLinters: {
    presets: ['allEslint', 'allStyleLint', 'allRemark'],
    description: ['All lint-related packages'],
  },
  automergeLinters: {
    packageRules: [
      {
        presets: ['allLinters'],
        automerge: 'any',
      },
    ],
  },
};
