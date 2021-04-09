import { LANGUAGE_GOLANG } from '../../constants/languages';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export const language = LANGUAGE_GOLANG;
export { extractPackageFile, updateDependency, updateArtifacts };

export const defaultConfig = {
  fileMatch: ['(^|/)go.mod$'],
};
