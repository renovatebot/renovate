import { LANGUAGE_DOCKER } from '../../constants/languages';

export { extractPackageFile } from './extract';

export const language = LANGUAGE_DOCKER;

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values.yaml$'],
  pinDigests: false,
};
