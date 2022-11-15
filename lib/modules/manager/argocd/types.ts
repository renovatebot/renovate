export interface KubernetesResource {
  apiVersion: string;
}

export interface ApplicationSource {
  chart?: string;
  repoURL: string;
  targetRevision: string;
}

export interface Application extends KubernetesResource {
  kind: 'Application';
  spec: {
    source: ApplicationSource;
  };
}

export interface ApplicationSet extends KubernetesResource {
  kind: 'ApplicationSet';
  spec: {
    template: {
      spec: {
        source: ApplicationSource;
      };
    };
  };
}

export type ApplicationDefinition = Application | ApplicationSet;
