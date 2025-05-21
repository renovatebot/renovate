export interface Version {
  replaceString: string;
  version: string;
}

export interface MavenVersionExtract {
  maven?: Version;
  wrapper?: Version;
}
