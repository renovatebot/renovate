// valid keys are defined in https://github.com/conda/conda/blob/69fd3766392b0de3e875ca594e70bb49c7ba3c59/conda_env/env.py#L31
export type CondaEnvironment = {
  name: string;
  channels?: Array<string>;
  dependencies: Array<string | CondaPipKey>;
  variables?: Record<string, string>;
  prefix?: string;
  // conda-lock extensions, https://github.com/conda-incubator/conda-lock
  category?: string;
  platforms?: Array<string>;
};

export type CondaPipKey = {
  pip: Array<string>;
};
