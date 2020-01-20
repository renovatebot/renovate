export type Opt<T> = T | null | undefined;

export enum BinarySource {
  Auto = 'auto',
  Docker = 'docker',
  Global = 'global',
}

export interface ExecConfig {
  binarySource: Opt<BinarySource>;
  dockerUser: Opt<string>;
  localDir: Opt<string>;
  cacheDir: Opt<string>;
}

export type VolumesPair = [string, string];
export type VolumeOption = string | VolumesPair | null | undefined;

export interface DockerOptions {
  image: string;
  tag?: Opt<string>;
  volumes?: Opt<VolumeOption[]>;
  envVars?: Opt<Opt<string>[]>;
  cwd?: Opt<string>;
}
