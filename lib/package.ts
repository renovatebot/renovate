import fs from 'fs-extra';
import type { PackageJson } from 'type-fest';

export type RenovatPackageJson = PackageJson & {
  'engines-next': Record<string, string>;
};

export const pkg = JSON.parse(
  fs.readFileSync('../package.json', 'utf-8')
) as RenovatPackageJson;
