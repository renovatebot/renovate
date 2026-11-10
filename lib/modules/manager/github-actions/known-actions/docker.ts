import { DockerDatasource } from '../../../datasource/docker/index.ts';
import type { KnownActionConfig } from '../types.ts';

export const dockerActions: Record<string, KnownActionConfig> = {
  'zizmorcore/zizmor-action': {
    datasource: DockerDatasource.id,
    packageName: 'ghcr.io/zizmorcore/zizmor',
  },
};
