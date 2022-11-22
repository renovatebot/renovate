export interface TektonResource {
  spec: TektonResourceSpec;
  items: TektonResource[];
}

interface TektonResourceSpec {
  // TaskRun
  taskRef: TektonBundle;
  // PipelineRun
  pipelineRef: TektonBundle;
  // Pipeline
  tasks: TektonResourceSpec[];
  // TriggerTemplate
  resourcetemplates: TektonResource[];
}

export interface TektonBundle {
  bundle: string;
  resolver: string;
  resource: TektonResolverParamsField[];
  params: TektonResolverParamsField[];
}

export interface TektonResolverParamsField {
  name: string;
  value: string;
}
