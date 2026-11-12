interface BuiltInVersion {
  path: string[];
  depName: string;
  registryUrls?: string[];
}

const composeHotReloadRegistryUrl =
  'https://packages.jetbrains.team/maven/p/amper/compose-hot-reload';

export const builtInVersions: BuiltInVersion[] = [
  {
    path: ['kotlin', 'version'],
    depName: 'org.jetbrains.kotlin:kotlin-stdlib',
  },
  {
    path: ['kotlin', 'serialization', 'version'],
    depName: 'org.jetbrains.kotlinx:kotlinx-serialization-core',
  },
  {
    path: ['kotlin', 'rpc', 'version'],
    depName: 'org.jetbrains.kotlinx:kotlinx-rpc-bom',
  },
  {
    path: ['kotlin', 'ksp', 'version'],
    depName: 'com.google.devtools.ksp:symbol-processing-api',
  },
  {
    path: ['kotlin', 'dataframe', 'version'],
    depName: 'org.jetbrains.kotlinx:dataframe-core',
  },
  {
    path: ['compose', 'version'],
    depName: 'org.jetbrains.compose.runtime:runtime',
  },
  {
    path: ['compose', 'experimental', 'hotReload', 'version'],
    depName: 'org.jetbrains.compose.hot-reload:hot-reload-runtime-api',
    registryUrls: [composeHotReloadRegistryUrl],
  },
  {
    path: ['jvm', 'test', 'junitPlatformVersion'],
    depName: 'org.junit.platform:junit-platform-console-standalone',
  },
  {
    path: ['ktor', 'version'],
    depName: 'io.ktor:ktor-bom',
  },
  {
    path: ['lombok', 'version'],
    depName: 'org.projectlombok:lombok',
  },
  {
    path: ['springBoot', 'version'],
    depName: 'org.springframework.boot:spring-boot-dependencies',
  },
];
