export interface Container {
  image: string;
}
export interface Repository {
  type: 'git' | 'github' | 'bitbucket';
  name: string;
  ref: string;
}
export interface Resources {
  repositories: Repository[];
  containers: Container[];
}
export interface AzurePipelines {
  resources: Resources;
}
