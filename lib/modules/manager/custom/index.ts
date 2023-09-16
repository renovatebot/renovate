import type { ManagerApi } from '../types';
import customManagers from './api';

export const customManagerList = Array.from(customManagers.keys());
export const getCustomManagers = (): Map<string, ManagerApi> => customManagers;

export function isCustomManager(manager: string): boolean {
  return customManagers.has(manager);
}
