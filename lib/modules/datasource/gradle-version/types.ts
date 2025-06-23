export interface GradleRelease {
  buildTime: string;
  broken: boolean;
  milestoneFor: string;
  nightly: boolean;
  rcFor: string;
  snapshot: boolean;
  version: string;
}
