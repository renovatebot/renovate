import type { ManagerApi } from '../types';
import customManagers from './api';

export const customManagerList = Array.from(customManagers.keys());
export const getCustomManagers = (): Map<string, ManagerApi> => customManagers;

export function get<T extends keyof ManagerApi>(
  manager: string,
  name: T
): ManagerApi[T] | undefined {
  return customManagers.get(manager)?.[name];
}

export function isCustomManager(manager: string): boolean {
  return !!customManagerList.includes(manager);
}
