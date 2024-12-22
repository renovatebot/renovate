export interface UnityReleasesJSON {
  results?: UnityRelease[];
}

export interface UnityRelease {
  version: string;
  releaseDate: string;
  releaseNotes: UnityReleaseNote;
  shortRevision: string;
}

export interface UnityReleaseNote {
  url: string;
}
