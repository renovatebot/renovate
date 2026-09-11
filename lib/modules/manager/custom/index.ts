import type { ManagerApi } from '../types.ts';
import customManagers from './api.ts';

export const customManagerList = Array.from(customManagers.keys());
export function getCustomManagers(): Map<string, ManagerApi> {
  return customManagers;
}

export function isCustomManager(manager: string): boolean {
  return customManagers.has(manager);
}
