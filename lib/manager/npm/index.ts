import { LANGUAGE_JAVASCRIPT } from '../../constants/languages';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';
export { getRangeStrategy } from './range';

export const language = LANGUAGE_JAVASCRIPT;
export const supportsLockFileMaintenance = true;
