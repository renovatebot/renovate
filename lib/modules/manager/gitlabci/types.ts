export interface GitlabIncludeLocal {
  local: string;
}

export interface GitlabIncludeProject {
  project: string;
  file?: string;
  ref?: string;
}

export interface GitlabIncludeRemote {
  remote: string;
}

export interface GitlabIncludeTemplate {
  template: string;
}

export interface GitlabPipeline {
  include?: GitlabInclude[] | GitlabInclude;
}

export interface ImageObject {
  name: string;
  entrypoint?: string[];
}
export interface ServicesObject extends ImageObject {
  command?: string[];
  alias?: string;
}
export interface Job {
  image?: Image;
  services?: Services;
}
export type Image = ImageObject | string;
export type Services = (string | ServicesObject)[];
export type GitlabInclude =
  | GitlabIncludeLocal
  | GitlabIncludeProject
  | GitlabIncludeRemote
  | GitlabIncludeTemplate
  | string;
