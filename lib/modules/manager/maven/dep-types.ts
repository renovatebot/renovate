import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'compile',
    description:
      'Dependency with `compile` scope (default); available on all classpaths',
  },
  {
    depType: 'provided',
    description:
      'Dependency with `provided` scope; expected to be supplied by the JDK or container at runtime',
  },
  {
    depType: 'runtime',
    description:
      'Dependency with `runtime` scope; required at runtime but not for compilation',
  },
  {
    depType: 'test',
    description:
      'Dependency with `test` scope; only used for test compilation and execution',
  },
  {
    depType: 'system',
    description:
      'Dependency with `system` scope; similar to `provided` but the JAR is specified explicitly',
  },
  {
    depType: 'import',
    description:
      'Dependency with `import` scope; used to import dependency management from another POM (BOM)',
  },
  {
    depType: 'optional',
    description:
      'Optional dependency (declared with `<optional>true</optional>`)',
  },
  {
    depType: 'build',
    description:
      'A build plugin or extension (`<plugin>` or `<extension>` element)',
  },
  {
    depType: 'parent',
    description: 'The parent POM (`<parent>` element)',
  },
  {
    depType: 'parent-root',
    description:
      'A parent POM that is itself a root POM or has an external parent; promoted from `parent` during multi-module resolution',
  },
];

export type MavenDepType = (typeof knownDepTypes)[number]['depType'];
