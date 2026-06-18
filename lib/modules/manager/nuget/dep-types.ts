import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'docker',
    description: 'Container base image from `ContainerBaseImage`',
  },
  {
    depType: 'nuget',
    description:
      'NuGet package reference from `PackageReference`, `PackageVersion`, or similar elements',
  },
  {
    depType: 'msbuild-sdk',
    description:
      'MSBuild SDK reference from `Sdk` elements, `Import` elements, or `Project Sdk` attribute',
  },
  {
    depType: 'dotnet-sdk',
    description: '.NET SDK version from `global.json`',
  },
] as const satisfies readonly DepTypeMetadata[];
