export interface MavenXmlPath {
  name: string;
  index: number;
}

export interface MavenManagerData {
  xmlPath?: MavenXmlPath[];
}

export interface MavenProp {
  val: string;
  fileReplacePosition: number;
  packageFile: string;
  xmlPath: MavenXmlPath[];
}
