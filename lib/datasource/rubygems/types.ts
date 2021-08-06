export interface MarshalledVersionInfo {
  name: string;
  number: string;
  platform: string;
  dependencies: MarshalledDependency[];
}

export type MarshalledDependency = [name: string, version: string];
