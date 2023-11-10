import upath from 'upath';
import { readLocalFile } from '../../../../util/fs';
import { Lazy } from '../../../../util/lazy';
import { PackageJson, PackageJsonSchema } from '../schema';

export function lazyLoadPackageJson(
  lockFileDir: string,
): Lazy<Promise<PackageJsonSchema>> {
  return new Lazy(() => loadPackageJson(lockFileDir));
}

export type LazyPackageJson = ReturnType<typeof lazyLoadPackageJson>;

export async function loadPackageJson(
  lockFileDir: string,
): Promise<PackageJsonSchema> {
  const json = await readLocalFile(
    upath.join(lockFileDir, 'package.json'),
    'utf8',
  );
  const res = PackageJson.safeParse(json);
  if (res.success) {
    return res.data;
  }
  return {};
}

export function getPackageManagerVersion(
  name: string,
  pkg: PackageJsonSchema,
): string | null {
  if (pkg.packageManager?.name === name) {
    return pkg.packageManager.version;
  }
  if (pkg.engines?.[name]) {
    return pkg.engines[name];
  }
  return null;
}
