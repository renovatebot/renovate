import is from '@sindresorhus/is';
import type { Preset } from '../types';

const repoGroups = {
  'ag-grid': 'https://github.com/ag-grid/ag-grid',
  'arcus.event-grid': 'https://github.com/arcus-azure/arcus.eventgrid',
  'arcus.security': 'https://github.com/arcus-azure/arcus.security',
  'arcus.messaging': 'https://github.com/arcus-azure/arcus.messaging',
  'arcus.observability': 'https://github.com/arcus-azure/arcus.observability',
  'arcus.webapi': 'https://github.com/arcus-azure/arcus.webapi',
  'arcus.background-jobs':
    'https://github.com/arcus-azure/arcus.backgroundjobs',
  'algolia-react-instantsearch':
    'https://github.com/algolia/react-instantsearch',
  'angular-eslint': 'https://github.com/angular-eslint/angular-eslint',
  'apollo-server': 'https://github.com/apollographql/apollo-server',
  'aspnet-api-versioning': 'https://github.com/Microsoft/aspnet-api-versioning',
  'aspnet aspnetwebstack': 'https://github.com/aspnet/AspNetWebStack',
  'aspnet extensions': 'https://github.com/aspnet/Extensions',
  'aws-cdk': 'https://github.com/aws/aws-cdk',
  'aws-sdk-js-v3': 'https://github.com/aws/aws-sdk-js-v3',
  'aws-sdk-net': 'https://github.com/aws/aws-sdk-net',
  'azure azure-libraries-for-net':
    'https://github.com/Azure/azure-libraries-for-net',
  'azure azure-sdk-for-net': 'https://github.com/Azure/azure-sdk-for-net',
  'azure azure-storage-net': 'https://github.com/Azure/azure-storage-net',
  'bugsnag-js': 'https://github.com/bugsnag/bugsnag-js',
  'chakra-ui': 'https://github.com/chakra-ui/chakra-ui',
  'contentful-rich-text': 'https://github.com/contentful/rich-text',
  'date-io': 'https://github.com/dmtrKovalenko/date-io',
  'devextreme-reactive': 'https://github.com/DevExpress/devextreme-reactive',
  'electron-forge': 'https://github.com/electron-userland/electron-forge',
  'ember-decorators': 'https://github.com/ember-decorators/ember-decorators',
  'graphql-modules': 'https://github.com/Urigo/graphql-modules',
  'ionic-native': 'https://github.com/ionic-team/ionic-native',
  'mdc-react': 'material-components/material-components-web-react',
  'ngx-formly': 'https://github.com/ngx-formly/ngx-formly',
  'ngxs-store': 'https://github.com/ngxs/store',
  'reach-ui': 'https://github.com/reach/reach-ui',
  'react-apollo': 'https://github.com/apollographql/react-apollo',
  'react-dnd': 'https://github.com/react-dnd/react-dnd',
  'react-navigation': 'https://github.com/react-navigation/react-navigation',
  'reactivestack-cookies': 'https://github.com/reactivestack/cookies',
  'reg-suit': 'https://github.com/reg-viz/reg-suit',
  'semantic-release': 'https://github.com/semantic-release/',
  'system.io.abstractions':
    'https://github.com/System-IO-Abstractions/System.IO.Abstractions/',
  'telus-tds-core': 'https://github.com/telus/tds-core', // Original URL redirects to tds-core
  'shopify-app-bridge': 'https://github.com/Shopify/app-bridge',
  'theme-ui': 'https://github.com/system-ui/theme-ui',
  'typescript-eslint': 'https://github.com/typescript-eslint/typescript-eslint',
  'typography-js': 'https://github.com/KyleAMathews/typography.js',
  'vue-cli': 'https://github.com/vuejs/vue-cli',
  accounts: 'https://github.com/accounts-js/accounts',
  angularjs: 'https://github.com/angular/angular.js',
  angular: 'https://github.com/angular/angular',
  'angular-cli': 'https://github.com/angular/angular-cli',
  angularfire: 'https://github.com/angular/angularfire',
  apolloclient: 'https://github.com/apollographql/apollo-client',
  awsappsync: 'https://github.com/awslabs/aws-mobile-appsync-sdk-js',
  babel: 'https://github.com/babel/babel',
  baset: 'https://github.com/igmat/baset',
  brave: 'https://github.com/openzipkin/brave',
  capacitor: 'https://github.com/ionic-team/capacitor',
  chromely: 'https://github.com/chromelyapps/Chromely',
  clarity: 'https://github.com/vmware/clarity',
  commitlint: 'https://github.com/conventional-changelog/commitlint',
  docusaurus: 'https://github.com/facebook/docusaurus',
  dotnet: [
    'https://github.com/dotnet/aspnetcore',
    'https://github.com/dotnet/efcore',
    'https://github.com/dotnet/extensions',
    'https://github.com/dotnet/runtime',
  ],
  dropwizard: 'https://github.com/dropwizard/dropwizard',
  emotion: 'https://github.com/emotion-js/emotion',
  expo: 'https://github.com/expo/expo',
  feathers: 'https://github.com/feathersjs/feathers',
  fimbullinter: 'https://github.com/fimbullinter/wotan',
  flopflip: 'https://github.com/tdeekens/flopflip',
  fontsource: 'https://github.com/fontsource/fontsource',
  formatjs: 'https://github.com/formatjs/formatjs',
  framework7: 'https://github.com/framework7io/framework7',
  gatsby: 'https://github.com/gatsbyjs/gatsby',
  graphqlcodegenerator: [
    'https://github.com/dotansimha/graphql-code-generator',
    'https://github.com/dotansimha/graphql-codegen',
  ],
  'graphql-mesh': 'https://github.com/Urigo/graphql-mesh',
  'graphql-tools': 'https://github.com/ardatan/graphql-tools',
  javahamcrest: 'https://github.com/hamcrest/JavaHamcrest',
  Hangfire: 'https://github.com/HangfireIO/Hangfire',
  hapijs: 'https://github.com/hapijs',
  hotchocolate: 'https://github.com/ChilliCream/hotchocolate',
  'infrastructure-ui': 'https://github.com/instructure/instructure-ui',
  istanbuljs: 'https://github.com/istanbuljs/istanbuljs',
  jasmine: 'https://github.com/jasmine/jasmine',
  jersey: 'https://github.com/eclipse-ee4j/jersey',
  jest: 'https://github.com/facebook/jest',
  junit5: 'https://github.com/junit-team/junit5',
  lerna: 'https://github.com/lerna/lerna',
  linguijs: 'https://github.com/lingui/js-lingui',
  lodash: 'https://github.com/lodash/',
  loopback: 'https://github.com/strongloop/loopback-next', // Seems they use just LoopBack as brandname without the next part
  lrnwebcomponents: 'https://github.com/elmsln/lrnwebcomponents',
  masstransit: 'https://github.com/MassTransit/MassTransit',
  'material-components-web':
    'https://github.com/material-components/material-components-web',
  mdx: 'https://github.com/mdx-js/mdx',
  'material-ui': 'https://github.com/mui-org/material-ui',
  nest: 'https://github.com/nestjs/nest',
  neutrino: [
    'https://github.com/neutrinojs/neutrino',
    'https://github.com/mozilla-neutrino/neutrino-dev',
  ],
  nextjs: [
    'https://github.com/zeit/next.js', // old repo
    'https://github.com/vercel/next.js',
  ],
  nivo: 'https://github.com/plouc/nivo',
  ngrx: 'https://github.com/ngrx/',
  nrwl: 'https://github.com/nrwl/',
  nuxtjs: 'https://github.com/nuxt/nuxt.js',
  orleans: 'https://github.com/dotnet/orleans',
  feign: 'https://github.com/OpenFeign/feign', // Project uses Feign as brandname, not openfeign
  'opentelemetry-js': 'https://github.com/open-telemetry/opentelemetry-js',
  'opentelemetry-dotnet':
    'https://github.com/open-telemetry/opentelemetry-dotnet', // Let's just use the reponame here, brandname is OpenTelemetry .NET
  picassojs: 'https://github.com/qlik-oss/picasso.js', // Brandname: picasso.js
  pnpjs: 'https://github.com/pnp/pnpjs',
  playwright: 'https://github.com/Microsoft/playwright',
  pollyjs: 'https://github.com/Netflix/pollyjs',
  pouchdb: 'https://github.com/pouchdb/pouchdb',
  prisma: 'https://github.com/prisma/prisma',
  react: 'https://github.com/facebook/react',
  'react-router': 'https://github.com/ReactTraining/react-router', // Might as well put a hyphen in to clarify
  reakit: 'https://github.com/reakit/reakit',
  redwood: 'https://github.com/redwoodjs/redwood',
  remark: 'https://github.com/remarkjs/remark',
  router5: 'https://github.com/router5/router5',
  'sentry-javascript': 'https://github.com/getsentry/sentry-javascript', // Brandname Sentry, have variants Java/JavaScript/dotnet/unity/etc.
  springfox: 'https://github.com/springfox/springfox',
  sanity: 'https://github.com/sanity-io/sanity',
  steeltoe: 'https://github.com/SteeltoeOSS/steeltoe',
  storybook: 'https://github.com/storybookjs/storybook',
  strapi: 'https://github.com/strapi/strapi',
  'stryker-js': 'https://github.com/stryker-mutator/stryker-js',
  surveyjs: 'https://github.com/surveyjs/surveyjs',
  'swashbuckle-aspnetcore':
    'https://github.com/domaindrivendev/Swashbuckle.AspNetCore',
  treat: 'https://github.com/seek-oss/treat',
  typefaces: 'https://github.com/KyleAMathews/typefaces', // Project deprecated in README, project recommends fontsource. Do we want to keep this entry?
  uppy: 'https://github.com/transloadit/uppy',
  vue: 'https://github.com/vuejs/vue',
  vuepress: 'https://github.com/vuejs/vuepress',
  webdriverio: 'https://github.com/webdriverio/webdriverio',
  workbox: 'https://github.com/googlechrome/workbox',
};

const patternGroups = {
  babel6: '^babel6$',
  clarity: ['^@cds/', '^@clr/'],
  wordpress: '^@wordpress/',
  angularmaterial: ['^@angular/material', '^@angular/cdk'],
  'aws-java-sdk': '^com.amazonaws:aws-java-sdk-',
  embroider: '^@embroider/',
  fullcalendar: '^@fullcalendar/',
};

export const presets: Record<string, Preset> = {};

for (const [name, value] of Object.entries(repoGroups)) {
  presets[name] = {
    description: `${name} monorepo`,
    matchSourceUrlPrefixes: is.array(value) ? value : [value],
  };
}
for (const [name, value] of Object.entries(patternGroups)) {
  presets[name] = {
    description: `${name} monorepo`,
    matchPackagePatterns: is.array(value) ? value : [value],
  };
}
