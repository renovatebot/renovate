import type { ManagerConfig } from '../../../config/types';
import type { CustomExtractConfig } from '../custom/types';

interface PluralFile extends PluralFileContent {
  fileName: string;
}

interface PluralFileContent {
  content: string
}

interface PluralResource extends PluralFile {
  services: Array<ServiceDeployment>;
}

const ResourceKind = {
  ServiceDeployment: 'ServiceDeployment',
  GitRepository: 'GitRepository',
  HelmRepository: 'HelmRepository',
} as const;

interface ServiceDeployment extends PluralFileContent {
  apiVersion: string;
  kind: typeof ResourceKind[keyof typeof ResourceKind];
  metadata: {
    name: string
    namespace: string
  };
  spec: {
    namespace: string
    git: {
      folder: string
      ref: string
    }
    repositoryRef: {
      kind: string
      name: string
      namespace: string
    }
    helm: {
      version: string
      chart: string
      valuesFiles: Array<string>
      repository: {
        namespace: string
        name: string
      }
    }
    clusterRef: {
      kind: string
      name: string
      namespace: string
    }
  };
}

interface HelmRepository extends PluralFileContent {
  apiVersion: string;
  kind: typeof ResourceKind[keyof typeof ResourceKind];
  metadata: {
    name: string
    namespace: string
  };
  spec: {
    interval: string
    url: string
  };
}

interface PluralConfig extends CustomExtractConfig, ManagerConfig {
}

type RegExpGroups<T extends string> =
  | (RegExpMatchArray & {
  groups?: { [name in T]: string } | { [key: string]: string };
})
  | null;

export type {
  ServiceDeployment,
  HelmRepository,
  PluralConfig,
  RegExpGroups,
  PluralFile,
  PluralResource,
};
export { ResourceKind };
