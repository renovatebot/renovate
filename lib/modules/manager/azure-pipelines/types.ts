export interface Container {
  image?: string | null;
}
export interface Repository {
  type: 'git' | 'github' | 'bitbucket';
  name: string;
  ref?: string | null;
}
export interface Resources {
  repositories?: Repository[];
  containers?: Container[];
}
export interface AzurePipelines {
  resources?: Resources;
  stages?: Stage[];
  jobs?: Job[];
  steps?: Step[];
}

export interface Stage {
  jobs?: Job[];
}

export interface On {
  failure?: Job;
  success?: Job;
}

export interface Deploy {
  deploy?: Job;
  preDeploy?: Job;
  routeTraffic?: Job;
  postRouteTraffic?: Job;
  on?: On;
}

export interface Strategy {
  runOnce?: Deploy;
  rolling?: Deploy;
  canary?: Deploy;
}

export interface Deployment {
  strategy?: Strategy;
}

export interface Job {
  steps?: Step[];
}

export interface Step {
  task: string;
}
