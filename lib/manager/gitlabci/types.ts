export interface GitlabInclude {
  local?: string;
}

export interface GitlabPipeline {
  include?: GitlabInclude[] | string;
}
