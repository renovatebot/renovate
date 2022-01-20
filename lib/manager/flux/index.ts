import { id as GithubReleasesId } from '../../datasource/github-releases';
import { HelmDatasource } from '../../datasource/helm';
import { logger } from '../../logger';
import { exec } from '../../util/exec';
import type { ExecOptions } from '../../util/exec/types';
//import { doAutoReplace } from '../../workers/branch/auto-replace';
import type { UpdateDependencyConfig } from '../types';
export { extractAllPackageFiles, extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [GithubReleasesId, HelmDatasource.id];

export async function updateDependency({
  upgrade,
}: UpdateDependencyConfig): Promise<string> {
  if (upgrade.packageFile.endsWith('/flux-system/gotk-components.yaml')) {
    logger.debug(`Updating flux-system manifests`);
    const cmd = 'flux install --export';
    const execOptions: ExecOptions = {
      docker: {
        image: 'fluxcd/flux-cli',
        tag: upgrade.newVersion,
      },
    };
    const result = await exec(cmd, execOptions);
    return result.stdout;
  }
  return null;
  // return await doAutoReplace(
  //   upgrade,
  //   packageFileContent,
  //   reuseExistingBranch
  // );
}
