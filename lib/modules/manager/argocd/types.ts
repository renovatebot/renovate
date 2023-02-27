export interface KubernetesResource {
  apiVersion: string;
}

export interface ApplicationSource {
  chart?: string;
  repoURL: string;
  targetRevision: string;
  ref?: string;
}

export interface Application extends KubernetesResource {
  kind: 'Application';
  spec: {
    source?: ApplicationSource;
    sources?: Array<ApplicationSource>;
  };
}

export interface ApplicationSet extends KubernetesResource {
  kind: 'ApplicationSet';
  spec: {
    template: {
      spec: {
        source?: ApplicationSource;
        sources?: Array<ApplicationSource>;
      };
    };
  };
}

export type ApplicationDefinition = Application | ApplicationSet;
