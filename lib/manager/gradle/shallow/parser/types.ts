import { ParseGradleResult } from '../types';

export interface GradleContext {
  result: ParseGradleResult;
  packageFile: string;
  variableName?: string;
  otherPackageFile?: string;
  fileReplacePosition?: number;
  groupId?: string;
  artifactId?: string;
  version?: string;
  dataType?: string;
  paramName?: string;
}
