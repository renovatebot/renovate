export interface KubernetesResource {
  apiVersion: string;
}

export interface ApplicationSource {
  chart?: string;
  repoURL: string;
  targetRevision: string;
}

export interface ApplicationSpec {
  source?: ApplicationSource;
  sources?: ApplicationSource[];
}

export interface Application extends KubernetesResource {
  kind: 'Application';
  spec: ApplicationSpec;
}

export interface ApplicationSet extends KubernetesResource {
  kind: 'ApplicationSet';
  spec: {
    template: {
      spec: ApplicationSpec;
    };
  };
}

export type ApplicationDefinition = Application | ApplicationSet;
