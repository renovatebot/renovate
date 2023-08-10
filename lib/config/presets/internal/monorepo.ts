import is from '@sindresorhus/is';
import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

const repoGroups = {
  accounts: 'https://github.com/accounts-js/accounts',
  acot: 'https://github.com/acot-a11y/acot',
  'ag-grid': 'https://github.com/ag-grid/ag-grid',
  'algolia-instantsearch': [
    'https://github.com/algolia/instantsearch',
    'https://github.com/algolia/instantsearch.js',
  ],
  'algolia-react-instantsearch':
    'https://github.com/algolia/react-instantsearch',
  'algoliasearch-autocomplete': 'https://github.com/algolia/autocomplete',
  'algoliasearch-client-javascript':
    'https://github.com/algolia/algoliasearch-client-javascript',
  angular: 'https://github.com/angular/angular',
  'angular-cli': 'https://github.com/angular/angular-cli',
  'angular-eslint': 'https://github.com/angular-eslint/angular-eslint',
  angularfire: 'https://github.com/angular/angularfire',
  angularjs: 'https://github.com/angular/angular.js',
  'apollo-server': 'https://github.com/apollographql/apollo-server',
  apolloclient: 'https://github.com/apollographql/apollo-client',
  'applicationinsights-dotnet':
    'https://github.com/Microsoft/ApplicationInsights-dotnet',
  'arcus.background-jobs':
    'https://github.com/arcus-azure/arcus.backgroundjobs',
  'arcus.event-grid': 'https://github.com/arcus-azure/arcus.eventgrid',
  'arcus.messaging': 'https://github.com/arcus-azure/arcus.messaging',
  'arcus.observability': 'https://github.com/arcus-azure/arcus.observability',
  'arcus.security': 'https://github.com/arcus-azure/arcus.security',
  'arcus.webapi': 'https://github.com/arcus-azure/arcus.webapi',
  'aspnet aspnetwebstack': 'https://github.com/aspnet/AspNetWebStack',
  'aspnet extensions': 'https://github.com/aspnet/Extensions',
  'aspnet-api-versioning': 'https://github.com/Microsoft/aspnet-api-versioning',
  'automapper-dotnet': [
    'https://github.com/AutoMapper/AutoMapper',
    'https://github.com/AutoMapper/AutoMapper.Extensions.Microsoft.DependencyInjection',
  ],
  'aws-cdk': 'https://github.com/aws/aws-cdk',
  'aws-lambda-powertools-typescript': [
    'https://github.com/awslabs/aws-lambda-powertools-typescript',
    'https://github.com/aws-powertools/powertools-lambda-typescript',
  ],
  'aws-sdk-js-v3': 'https://github.com/aws/aws-sdk-js-v3',
  'aws-sdk-net': 'https://github.com/aws/aws-sdk-net',
  awsappsync: 'https://github.com/awslabs/aws-mobile-appsync-sdk-js',
  'azure azure-libraries-for-net':
    'https://github.com/Azure/azure-libraries-for-net',
  'azure azure-sdk-for-net': 'https://github.com/Azure/azure-sdk-for-net',
  'azure azure-storage-net': 'https://github.com/Azure/azure-storage-net',
  babel: 'https://github.com/babel/babel',
  baset: 'https://github.com/igmat/baset',
  brave: 'https://github.com/openzipkin/brave',
  'bugsnag-js': 'https://github.com/bugsnag/bugsnag-js',
  cake: 'https://github.com/cake-build/cake',
  capacitor: 'https://github.com/ionic-team/capacitor',
  'chakra-ui': 'https://github.com/chakra-ui/chakra-ui',
  chromely: 'https://github.com/chromelyapps/Chromely',
  clarity: 'https://github.com/vmware/clarity',
  clearscript: [
    'https://github.com/microsoft/ClearScript',
    'https://github.com/Microsoft/ClearScript',
  ],
  commitlint: 'https://github.com/conventional-changelog/commitlint',
  'contentful-rich-text': 'https://github.com/contentful/rich-text',
  'datadog-browser-sdk': 'https://github.com/DataDog/browser-sdk',
  'date-io': 'https://github.com/dmtrKovalenko/date-io',
  deno: 'https://github.com/denoland/deno',
  'devextreme-reactive': 'https://github.com/DevExpress/devextreme-reactive',
  'dnd-kit': 'https://github.com/clauderic/dnd-kit',
  docusaurus: 'https://github.com/facebook/docusaurus',
  dotnet: [
    'https://github.com/dotnet/aspnetcore',
    'https://github.com/dotnet/efcore',
    'https://github.com/dotnet/extensions',
    'https://github.com/dotnet/maui',
    'https://github.com/dotnet/runtime',
    'https://github.com/dotnet/sdk',
  ],
  'dotnet-azure-ad-identitymodel-extensions':
    'https://github.com/AzureAD/azure-activedirectory-identitymodel-extensions-for-dotnet',
  'dotnet-azure-ad-microsoft-identity-web':
    'https://github.com/AzureAD/microsoft-identity-web',
  'dotnet-wcf': 'https://github.com/dotnet/wcf',
  dropwizard: 'https://github.com/dropwizard/dropwizard',
  'elastic-apm-agent-rum-js': 'https://github.com/elastic/apm-agent-rum-js',
  'electron-forge': 'https://github.com/electron-userland/electron-forge',
  'ember-decorators': 'https://github.com/ember-decorators/ember-decorators',
  emojibase: 'https://github.com/milesj/emojibase',
  emotion: 'https://github.com/emotion-js/emotion',
  'eslint-config-globex':
    'https://github.com/GlobexDesignsInc/eslint-config-globex',
  expo: 'https://github.com/expo/expo',
  'fabric8-kubernetes-client': 'https://github.com/fabric8io/kubernetes-client',
  feathers: 'https://github.com/feathersjs/feathers',
  feign: 'https://github.com/OpenFeign/feign',
  fela: 'https://github.com/robinweser/fela',
  fimbullinter: 'https://github.com/fimbullinter/wotan',
  flopflip: 'https://github.com/tdeekens/flopflip',
  fontsource: [
    'https://github.com/fontsource/fontsource', // old repo
    'https://github.com/fontsource/font-files',
  ],
  formatjs: 'https://github.com/formatjs/formatjs',
  framework7: 'https://github.com/framework7io/framework7',
  gatsby: 'https://github.com/gatsbyjs/gatsby',
  gitbeaker: 'https://github.com/jdalrymple/gitbeaker',
  grafana: 'https://github.com/grafana/grafana',
  'graphql-mesh': 'https://github.com/Urigo/graphql-mesh',
  'graphql-modules': 'https://github.com/Urigo/graphql-modules',
  'graphql-tools': 'https://github.com/ardatan/graphql-tools',
  graphqlcodegenerator: [
    'https://github.com/dotansimha/graphql-code-generator-community',
    'https://github.com/dotansimha/graphql-code-generator',
    'https://github.com/dotansimha/graphql-codegen',
  ],
  groovy: 'https://github.com/apache/groovy',
  guava: 'https://github.com/google/guava',
  Hangfire: 'https://github.com/HangfireIO/Hangfire',
  'infrastructure-ui': 'https://github.com/instructure/instructure-ui',
  'ionic-native': 'https://github.com/ionic-team/ionic-native',
  istanbuljs: 'https://github.com/istanbuljs/istanbuljs',
  jasmine: 'https://github.com/jasmine/jasmine',
  javahamcrest: 'https://github.com/hamcrest/JavaHamcrest',
  javascriptengineswitcher:
    'https://github.com/Taritsyn/JavaScriptEngineSwitcher',
  jersey: 'https://github.com/eclipse-ee4j/jersey',
  jest: 'https://github.com/facebook/jest',
  jsplumb: 'https://github.com/jsplumb/jsplumb',
  junit5: 'https://github.com/junit-team/junit5',
  kotlin: 'https://github.com/JetBrains/kotlin',
  lerna: 'https://github.com/lerna/lerna',
  linguijs: 'https://github.com/lingui/js-lingui',
  loopback: [
    'https://github.com/strongloop/loopback-next', // old repo (see: https://github.com/loopbackio/loopback-next/issues/7595)
    'https://github.com/loopbackio/loopback-next',
  ],
  lrnwebcomponents: 'https://github.com/elmsln/lrnwebcomponents',
  mailing: 'https://github.com/sofn-xyz/mailing',
  mantine: 'https://github.com/mantinedev/mantine',
  mapstruct: 'https://github.com/mapstruct/mapstruct',
  masstransit: 'https://github.com/MassTransit/MassTransit',
  'material-components-web':
    'https://github.com/material-components/material-components-web',
  'material-ui': [
    'https://github.com/mui-org/material-ui', // Previous organization name (see: https://github.com/mui/material-ui/pull/30944)
    'https://github.com/mui/material-ui',
  ],
  'mdc-react': 'material-components/material-components-web-react',
  mdx: 'https://github.com/mdx-js/mdx',
  'middy-js': 'https://github.com/middyjs/middy',
  'mikro-orm': 'https://github.com/mikro-orm/mikro-orm',
  mockito: 'https://github.com/mockito/mockito',
  mstest: 'https://github.com/microsoft/testfx',
  'mutation-testing-elements':
    'https://github.com/stryker-mutator/mutation-testing-elements',
  nest: [
    'https://github.com/nestjs/nest',
    'https://github.com/nestjs/passport',
    'https://github.com/nestjs/schematics',
    'https://github.com/nestjs/terminus',
  ],
  netty: 'https://github.com/netty/netty',
  neutrino: [
    'https://github.com/neutrinojs/neutrino',
    'https://github.com/mozilla-neutrino/neutrino-dev',
  ],
  nexpect: 'https://github.com/fluffynuts/NExpect',
  nextjs: [
    'https://github.com/zeit/next.js', // old repo
    'https://github.com/vercel/next.js',
  ],
  nextra: 'https://github.com/shuding/nextra',
  'ngx-formly': 'https://github.com/ngx-formly/ngx-formly',
  'ngxs-store': 'https://github.com/ngxs/store',
  nivo: 'https://github.com/plouc/nivo',
  nswag: 'https://github.com/RicoSuter/NSwag',
  nuxtjs: [
    'https://github.com/nuxt/nuxt.js', // old repo
    'https://github.com/nuxt/nuxt',
  ],
  'opentelemetry-dotnet':
    'https://github.com/open-telemetry/opentelemetry-dotnet',
  'opentelemetry-go': 'https://github.com/open-telemetry/opentelemetry-go',
  'opentelemetry-js': 'https://github.com/open-telemetry/opentelemetry-js',
  orleans: 'https://github.com/dotnet/orleans',
  parcel: 'https://github.com/parcel-bundler/parcel',
  'percy-cli': 'https://github.com/percy/cli',
  picassojs: 'https://github.com/qlik-oss/picasso.js',
  pixijs: [
    'https://github.com/pixijs/pixi.js', // old repo
    'https://github.com/pixijs/pixijs',
  ],
  playwright: 'https://github.com/Microsoft/playwright',
  pnpjs: 'https://github.com/pnp/pnpjs',
  pollyjs: 'https://github.com/Netflix/pollyjs',
  pouchdb: 'https://github.com/pouchdb/pouchdb',
  prisma: 'https://github.com/prisma/prisma',
  quartznet: 'https://github.com/quartznet/quartznet',
  'reach-ui': 'https://github.com/reach/reach-ui',
  react: 'https://github.com/facebook/react',
  'react-admin': 'https://github.com/marmelab/react-admin',
  'react-apollo': 'https://github.com/apollographql/react-apollo',
  'react-dnd': 'https://github.com/react-dnd/react-dnd',
  'react-navigation': 'https://github.com/react-navigation/react-navigation',
  'react-page': 'https://github.com/react-page/react-page',
  'react-router': [
    'https://github.com/ReactTraining/react-router', // old repo
    'https://github.com/remix-run/react-router',
  ],
  'reactivestack-cookies': 'https://github.com/reactivestack/cookies',
  reakit: 'https://github.com/reakit/reakit',
  redwood: 'https://github.com/redwoodjs/redwood',
  'reg-suit': 'https://github.com/reg-viz/reg-suit',
  remark: 'https://github.com/remarkjs/remark',
  remix: 'https://github.com/remix-run/remix',
  rjsf: 'https://github.com/rjsf-team/react-jsonschema-form',
  router5: 'https://github.com/router5/router5',
  'rust-futures': 'https://github.com/rust-lang/futures-rs',
  'rust-wasm-bindgen': 'https://github.com/rustwasm/wasm-bindgen',
  sanity: 'https://github.com/sanity-io/sanity',
  scaffdog: 'https://github.com/scaffdog/scaffdog',
  'sendgrid-nodejs': 'https://github.com/sendgrid/sendgrid-nodejs',
  'sentry-dotnet': 'https://github.com/getsentry/sentry-dotnet',
  'sentry-javascript': 'https://github.com/getsentry/sentry-javascript',
  'sentry-ruby': 'https://github.com/getsentry/sentry-ruby',
  shedlock: 'https://github.com/lukas-krecan/ShedLock',
  'shopify-app-bridge': 'https://github.com/Shopify/app-bridge',
  'sitecore-jss': 'https://github.com/Sitecore/jss',
  skiasharp: 'https://github.com/mono/SkiaSharp',
  'spectre-console': 'https://github.com/spectreconsole/spectre.console',
  springfox: 'https://github.com/springfox/springfox',
  steeltoe: 'https://github.com/SteeltoeOSS/steeltoe',
  storybook: 'https://github.com/storybookjs/storybook',
  'storybook-react-native': 'https://github.com/storybookjs/react-native',
  strapi: 'https://github.com/strapi/strapi',
  'stryker-js': 'https://github.com/stryker-mutator/stryker-js',
  surveyjs: 'https://github.com/surveyjs/surveyjs',
  'swashbuckle-aspnetcore':
    'https://github.com/domaindrivendev/Swashbuckle.AspNetCore',
  'system.io.abstractions':
    'https://github.com/System-IO-Abstractions/System.IO.Abstractions/',
  'tanstack-query': 'https://github.com/TanStack/query',
  tauri: 'https://github.com/tauri-apps/tauri',
  'telus-tds': 'https://github.com/telusdigital/tds',
  'telus-tds-core': 'https://github.com/telus/tds-core',
  'temporalio-ts': 'https://github.com/temporalio/sdk-typescript',
  'testcontainers-java':
    'https://github.com/testcontainers/testcontainers-java',
  'testcontainers-node':
    'https://github.com/testcontainers/testcontainers-node',
  'theme-ui': 'https://github.com/system-ui/theme-ui',
  tiptap: 'https://github.com/ueberdosis/tiptap',
  treat: 'https://github.com/seek-oss/treat',
  trpc: 'https://github.com/trpc/trpc',
  tsoa: 'https://github.com/lukeautry/tsoa',
  turbo: 'https://github.com/vercel/turbo',
  typefaces: 'https://github.com/KyleAMathews/typefaces',
  'typescript-eslint': 'https://github.com/typescript-eslint/typescript-eslint',
  'typography-js': 'https://github.com/KyleAMathews/typography.js',
  uppy: 'https://github.com/transloadit/uppy',
  vaadinWebComponents: 'https://github.com/vaadin/web-components',
  vitest: 'https://github.com/vitest-dev/vitest',
  vstest: 'https://github.com/microsoft/vstest',
  vue: ['https://github.com/vuejs/vue', 'https://github.com/vuejs/core'],
  'vue-cli': 'https://github.com/vuejs/vue-cli',
  vuepress: 'https://github.com/vuejs/vuepress',
  webdriverio: 'https://github.com/webdriverio/webdriverio',
  workbox: 'https://github.com/googlechrome/workbox',
  xstate: 'https://github.com/statelyai/xstate',
  xterm: 'https://github.com/xtermjs/xterm.js',
  'xunit-dotnet': 'https://github.com/xunit/xunit',
  yarn: 'https://github.com/yarnpkg/berry',
  'zxing-net': 'https://github.com/micjahn/ZXing.Net',
};

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

const orgGroups = {
  'datatables-net': ['https://github.com/DataTables/'],
  hapijs: 'https://github.com/hapijs/',
  lodash: 'https://github.com/lodash/',
  ngrx: 'https://github.com/ngrx/',
  nrwl: 'https://github.com/nrwl/',
  octokit: 'https://github.com/octokit/',
  'semantic-release': 'https://github.com/semantic-release/',
  swc: 'https://github.com/swc-project/',
};

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

const patternGroups = {
  angularmaterial: ['^@angular/material', '^@angular/cdk'],
  'apache-camel': '^org.apache.camel:',
  'aws-java-sdk': '^com.amazonaws:aws-java-sdk-',
  'aws-java-sdk-v2': '^software.amazon.awssdk:',
  babel6: '^babel6$',
  clarity: ['^@cds/', '^@clr/'],
  embroider: '^@embroider/',
  fullcalendar: '^@fullcalendar/',
  hotchocolate: '^HotChocolate\\.',
  spfx: ['^@microsoft/sp-', '^@microsoft/eslint-.+-spfx$'],
  spock: '^org\\.spockframework:spock-',
  'syncfusion-dotnet': '^Syncfusion\\.',
  wordpress: '^@wordpress/',
};

export const presets: Record<string, Preset> = {};

for (const [name, value] of Object.entries(repoGroups)) {
  presets[name] = {
    description: `${name} monorepo`,
    matchSourceUrls: is.array(value) ? value : [value],
  };
}

for (const [name, value] of Object.entries(orgGroups)) {
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
