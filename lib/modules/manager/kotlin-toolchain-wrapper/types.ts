export type WrapperForm = 'shell' | 'batch';

export interface ParsedWrapper {
  version: string;
  versionLine: string;
  sha256: string | null;
  downloadRoot: string;
  form: WrapperForm;
}

export interface WrapperFile {
  name: string;
  artifactSuffix: string;
  isExecutable: boolean;
  form: WrapperForm;
}

export interface ExistingWrapper {
  path: string;
  file: WrapperFile;
}
