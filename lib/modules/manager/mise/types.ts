export type MisePackages = Record<string, string | string[]>;

export interface MiseFile {
  tools?: MisePackages; // The tools section of the .mise.toml
}
