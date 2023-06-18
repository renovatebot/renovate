export interface TektonResource {
  spec: TektonResourceSpec;
  items?: TektonResource[];
}

export interface TektonResourceSpec {
  // TaskRun
  taskRef: TektonBundle;
  // TaskRun with inline Pipeline definition
  taskSpec?: TektonResourceSpec;
  // PipelineRun
  pipelineRef: TektonBundle;
  // PipelienRun with inline Pipeline definition
  pipelineSpec?: TektonResourceSpec;
  // Pipeline
  tasks: TektonResourceSpec[];
  // Pipeline
  finally?: TektonResourceSpec[];
  // TriggerTemplate
  resourcetemplates: TektonResource[];

  steps?: TektonStep[];
  stepTemplate?: TektonStep;
  sidecars?: TektonStep[];
}

export interface TektonBundle {
  bundle: string;
  resolver: string;
  resource?: TektonResolverParamsField[];
  params?: TektonResolverParamsField[];
}

export interface TektonResolverParamsField {
  name: string;
  value: string;
}

export interface TektonStep {
  image?: string;
}
