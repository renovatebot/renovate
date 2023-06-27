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
  conanName: string;
  userAndChannel: string;
}

export interface ConanRecipeProperties {
  'conan.package.channel': string[];
  'conan.package.license': string[];
  'conan.package.name': string[];
  'conan.package.url': string[];
  'conan.package.user': string[];
  'conan.package.version': string[];
}

export interface ConanProperties {
  properties: ConanRecipeProperties;
  uri: string;
}
