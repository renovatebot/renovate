export interface ConanJSON {
  results?: Record<string, string>;
}

export interface ConanRevisionJSON {
  revision: string;
  time: string;
}

export interface ConanRevisionsJSON {
  revisions?: Record<string, ConanRevisionJSON>;
}

export interface ConanYAML {
  versions?: Record<string, unknown>;
}

export interface ConanPackage {
  depName: string;
  userAndChannel: string;
}
