export interface Container {
  image: string;
}

export interface Job {
  container?: string | Container;
  services?: Map<string, string | Container>;
}

export interface Workflow {
  jobs: Map<string, Job>;
}
