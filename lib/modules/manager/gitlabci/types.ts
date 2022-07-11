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
