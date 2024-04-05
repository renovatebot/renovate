export interface Version {
  url: string;
  version: string;
}

export interface MavenVersionExtract {
  maven?: Version;
  wrapper?: Version;
}
