export interface MavenProp {
  val: string;
  fileReplacePosition: number;
  packageFile: string;
}

export interface MavenSettings {
  repositories: MavenRepository[];
  mirrors: MavenMirror[];
}

export interface MavenRepository {
  id: string;
  url: string;
}

export interface MavenMirror extends MavenRepository {
  mirrorOf: string;
}
