export interface GitlabInclude {
  local?: string;
}

export interface GitlabPipeline {
  include?: GitlabInclude[] | string;
}

export interface ImageObject {
  name: string;
  entrypoint?: string[];
}
export interface ServicesObject {
  name: string;
  entrypoint?: string[];
  command?: string[];
  alias?: string;
}

export type Image = ImageObject | string;
export type Services = (string | ServicesObject)[];
