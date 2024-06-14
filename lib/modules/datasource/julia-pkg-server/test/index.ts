import { readFile, readdir } from 'node:fs/promises';
import { create as tarCreate } from 'tar';
// This is a test dependency so belongs in the `devDependencies`
// eslint-disable-next-line import/no-extraneous-dependencies
import { withFile } from 'tmp-promise';
import { Fixtures } from '../../../../../test/fixtures';

export async function createRegistryTarballFromFixture(
  registryName: string,
): Promise<Buffer> {
  const registryFixturePath = Fixtures.getPath(registryName, '..');
  const registryFiles = await readdir(registryFixturePath);

  return withFile(async ({ path: tarballPath }) => {
    await tarCreate(
      {
        cwd: registryFixturePath,
        file: tarballPath,
      },
      registryFiles,
    );

    return readFile(tarballPath);
  });
}
