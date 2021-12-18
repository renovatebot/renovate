import fs from 'fs-extra';
import type { PackageJson } from 'type-fest';
import expose from './expose.cjs';

export type RenovatPackageJson = PackageJson & {
  'engines-next': Record<string, string>;
};

export const pkg = JSON.parse(
  fs.readFileSync(`${expose}/../package.json`, 'utf-8')
) as RenovatPackageJson;
