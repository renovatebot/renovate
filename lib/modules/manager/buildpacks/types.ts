export interface BuildpackGroup {
  uri?: string;
}

export interface IoBuildpacks {
  builder?: string;
  group?: BuildpackGroup[];
}

export interface ProjectDescriptor {
  'schema-version'?: string;
  io: {
    buildpacks?: IoBuildpacks;
  };
}
