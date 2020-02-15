import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { updateArtifacts } from './artifacts';
import { LANGUAGE_GOLANG } from '../../constants/languages';

export const language = LANGUAGE_GOLANG;
export { extractPackageFile, updateDependency, updateArtifacts };

export const defaultConfig = {
  fileMatch: ['(^|/)go.mod$'],
};
