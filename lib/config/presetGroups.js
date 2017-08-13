module.exports = {
  allJest: {
    description: 'All jest packages',
    packagePatterns: ['jest'],
  },
  groupJest: {
    description: 'Group together jest packages',
    packageRules: [
      {
        extends: ['allJest'],
        groupName: 'jest',
      },
    ],
  },
  allAngular: {
    description: 'All angular.js packages',
    packageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  groupAngular: {
    description: 'Group together angular.js packages',
    packageRules: [
      {
        extends: ['allAngular'],
        groupName: 'angular.js',
      },
    ],
  },
  allMapbox: {
    description: 'All mapbox-related packages',
    packagePatterns: ['^(leaflet|mapbox)'],
  },
  groupMapbox: {
    description: 'Group together mapbox packages',
    packageRules: [
      {
        extends: ['allMapbox'],
        groupName: 'mapbox',
      },
    ],
  },
  allEslint: {
    description: 'All eslint packages',
    packagePatterns: ['^eslint'],
  },
  groupEslint: {
    description: 'Group all package starting with eslint',
    packageRules: [
      {
        extends: ['allEslint'],
        groupName: 'eslint',
      },
    ],
  },
  allStylelint: {
    description: 'All stylelint packages',
    packagePatterns: ['^stylelint'],
  },
  groupStylelint: {
    description: 'Group all stylelint-prefixed packages',
    packageRules: [
      {
        extends: ['allStylelint'],
        groupName: 'stylelint',
      },
    ],
  },
  allRemark: {
    description: 'All remark packages',
    packagePatterns: ['^remark'],
  },
  groupRemark: {
    description: 'Group remark packages into same PR',
    packageRules: [
      {
        extends: ['allRemark'],
        groupName: 'remark',
      },
    ],
  },
  allLinters: {
    description: 'All lint-related packages',
    extends: ['allEslint', 'allStyleLint', 'allRemark'],
  },
};
