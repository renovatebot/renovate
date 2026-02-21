import * as looseVersioning from '../../versioning/loose/index.ts';
import * as nodeVersioning from '../../versioning/node/index.ts';
import * as pythonVersioning from '../../versioning/python/index.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';
import * as semver from '../../versioning/semver/index.ts';
import type { VersioningApi } from '../../versioning/types.ts';

export type ToolVersioning = Record<string, { api: VersioningApi; id: string }>;

export const devboxToolVersioning: ToolVersioning = {
  nodejs: {
    api: nodeVersioning.api,
    id: nodeVersioning.id,
  },
  ruby: {
    api: rubyVersioning.api,
    id: rubyVersioning.id,
  },
  python: {
    api: pythonVersioning.api,
    id: pythonVersioning.id,
  },
  // Using loose versioning due to versions like 1.2.3+2
  jdk: {
    api: semver.api,
    id: semver.id,
  },
  // Using loose versioning due to versions like 1.2
  postgresql: {
    api: looseVersioning.api,
    id: looseVersioning.id,
  },
  // Using python versioning due to versions like 1.2beta2
  // seems odd, but Go does actually follow python versioning rules for the language
  go: {
    api: pythonVersioning.api,
    id: pythonVersioning.id,
  },
};
