export type MisePackages = Record<
  string,
  string | { version: string } | string[]
>;

export interface MiseFile {
  tools?: MisePackages; // The tools section of the .mise.toml
}
