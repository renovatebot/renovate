export interface EKSAddonsFilter {
  kubernetesVersion: string;
  addonName: string;
  region?: string;
  profile?: string;
}
