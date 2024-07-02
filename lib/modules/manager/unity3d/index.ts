import type { Category } from '../../../constants';
import { Unity3dDatasource } from '../../datasource/unity3d';
import { fileMatchRegex } from './extract';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: fileMatchRegex,
  packageRules: [
    {
      groupName: 'Unity Editor',
      matchPackageNames: ['m_EditorVersion', 'm_EditorVersionWithRevision'],
    },
  ],
};

export const categories: Category[] = ['unity3d'];

export const supportedDatasources = [Unity3dDatasource.id];
