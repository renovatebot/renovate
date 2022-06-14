import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import { platform } from '../../../modules/platform';

export async function raiseDeprecationWarnings(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>
): Promise<void> {
  if (!config.repoIsOnboarded) {
    return;
  }
  if (config.suppressNotifications?.includes('deprecationWarningIssues')) {
    return;
  }
  for (const [manager, files] of Object.entries(packageFiles)) {
    const deprecatedPackages: Record<
      string,
      { deprecationMessage?: string; depPackageFiles: string[] }
    > = {};
    for (const packageFile of files) {
      for (const dep of packageFile.deps) {
        const { deprecationMessage } = dep;
        if (deprecationMessage) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          deprecatedPackages[dep.depName!] = deprecatedPackages[
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            dep.depName!
          ] || {
            deprecationMessage,
            depPackageFiles: [],
          };
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          deprecatedPackages[dep.depName!].depPackageFiles.push(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            packageFile.packageFile!
          );
        }
      }
    }

    logger.debug({ deprecatedPackages });
    const issueTitleList: string[] = [];
    const issueTitlePrefix = 'Dependency deprecation warning:';
    for (const [depName, val] of Object.entries(deprecatedPackages)) {
      const { deprecationMessage, depPackageFiles } = val;
      logger.debug(
        {
          depName,
          deprecationMessage,
          packageFiles: depPackageFiles,
        },
        'dependency is deprecated'
      );
      const issueTitle = `${issueTitlePrefix} ${depName} (${manager})`;
      issueTitleList.push(issueTitle);
      let issueBody = deprecationMessage;
      issueBody += `\n\nAffected package file(s): ${depPackageFiles
        .map((f) => '`' + f + '`')
        .join(', ')}`;
      issueBody += `\n\nIf you don't care about this, you can close this issue and not be warned about \`${depName}\`'s deprecation again. If you would like to completely disable all future deprecation warnings then add the following to your config:\n\n\`\`\`\n"suppressNotifications": ["deprecationWarningIssues"]\n\`\`\`\n\n`;
      // istanbul ignore if
      if (GlobalConfig.get('dryRun')) {
        logger.info('DRY-RUN: Ensure deprecation warning issue for ' + depName);
      } else {
        const ensureOnce = true;
        await platform.ensureIssue({
          title: issueTitle,
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          body: issueBody!,
          once: ensureOnce,
          confidential: config.confidential,
        });
      }
    }
    logger.debug(
      'Checking for existing deprecated package issues missing in current deprecatedPackages'
    );
    const issueList = await platform.getIssueList();
    if (issueList?.length) {
      const deprecatedIssues = issueList.filter(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        (i) => i.title!.startsWith(issueTitlePrefix) && i.state === 'open'
      );
      for (const i of deprecatedIssues) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        if (!issueTitleList.includes(i.title!)) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          await platform.ensureIssueClosing(i.title!);
        }
      }
    }
  }
}
