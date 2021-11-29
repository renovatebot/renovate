export interface ApplicationDefinition {
  spec: {
    source: {
      chart?: string;
      repoURL: string;
      targetRevision: string;
    };
  };
}
