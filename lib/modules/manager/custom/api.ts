import type { ExtractConfig, ManagerApi, PackageFile, Result } from '../types';
import * as regex from './regex';

export interface CustomManagerApi
  extends Omit<ManagerApi, 'extractPackageFile'> {
  extractPackageFile(
    content: string,
    packageFile?: string,
    config?: ExtractConfig
  ): Result<PackageFile | null>;
}
const api = new Map<string, CustomManagerApi>();
export default api;

api.set('regex', regex);
