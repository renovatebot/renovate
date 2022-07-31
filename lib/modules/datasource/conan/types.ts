export interface ConanJSON {
  results?: Record<string, string>;
}

export interface ConanRevisionJSON {
  revision?: string;
}

export interface ConanRevisionsJSON {
  revisions?: Record<string, ConanRevisionJSON>;
}

export interface ConanYAML {
  versions?: Record<string, unknown>;
}
