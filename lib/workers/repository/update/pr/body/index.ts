import type { RenovateConfig } from '../../../../../config/types.ts';
import type { PrDebugData } from '../../../../../modules/platform/index.ts';
import { platform } from '../../../../../modules/platform/index.ts';
import { detectPlatform } from '../../../../../util/common.ts';
import { regEx } from '../../../../../util/regex.ts';
import { toBase64 } from '../../../../../util/string.ts';
import * as template from '../../../../../util/template/index.ts';
import { joinUrlParts } from '../../../../../util/url.ts';
import type { BranchConfig } from '../../../../types.ts';
import { getDepWarningsPR, getWarnings } from '../../../errors-warnings.ts';
import { getChangelogs } from './changelogs.ts';
import { getPrConfigDescription } from './config-description.ts';
import { getControls } from './controls.ts';
import { getPrFooter } from './footer.ts';
import { getPrHeader } from './header.ts';
import { getPrExtraNotes, getPrNotes } from './notes.ts';
import { getPrUpdatesTable } from './updates-table.ts';

function massageUpdateMetadata(config: BranchConfig): void {
  config.upgrades.forEach((upgrade) => {
    const {
      homepage,
      sourceUrl,
      sourceDirectory,
      changelogUrl,
      dependencyUrl,
    } = upgrade;
    // TODO: types (#22198)
    let depNameLinked = upgrade.depName!;
    let newNameLinked = upgrade.newName!;
    const primaryLink = homepage ?? sourceUrl ?? dependencyUrl;
    if (primaryLink) {
      depNameLinked = `[${depNameLinked}](${primaryLink})`;
      newNameLinked = `[${newNameLinked}](${primaryLink})`;
    }

    let sourceRootPath = 'tree/HEAD';
    if (sourceUrl) {
      const sourcePlatform = detectPlatform(sourceUrl);
      if (sourcePlatform === 'bitbucket') {
        sourceRootPath = 'src/HEAD';
      } else if (sourcePlatform === 'bitbucket-server') {
        sourceRootPath = 'browse';
      }
    }

    const otherLinks = [];
    if (sourceUrl && (!!sourceDirectory || homepage)) {
      otherLinks.push(
        `[source](${getFullSourceUrl(sourceUrl, sourceRootPath, sourceDirectory)})`,
      );
    }
    const templatedChangelogUrl = changelogUrl
      ? template.compile(changelogUrl, upgrade, true)
      : undefined;
    if (templatedChangelogUrl) {
      otherLinks.push(`[changelog](${templatedChangelogUrl})`);
    }
    if (otherLinks.length) {
      depNameLinked += ` (${otherLinks.join(', ')})`;
    }
    upgrade.depNameLinked = depNameLinked;
    upgrade.newNameLinked = newNameLinked;
    const references: string[] = [];
    if (homepage) {
      references.push(`[homepage](${homepage})`);
    }
    if (sourceUrl) {
      references.push(
        `[source](${getFullSourceUrl(sourceUrl, sourceRootPath, sourceDirectory)})`,
      );
    }
    if (templatedChangelogUrl) {
      references.push(`[changelog](${templatedChangelogUrl})`);
    }
    upgrade.references = references.join(', ');
  });
}

function getFullSourceUrl(
  sourceUrl: string,
  sourceRootPath: string,
  sourceDirectory?: string,
): string {
  let fullUrl = sourceUrl;
  if (sourceDirectory) {
    fullUrl = joinUrlParts(sourceUrl, sourceRootPath, sourceDirectory);
  }

  return fullUrl;
}

interface PrBodyConfig {
  appendExtra?: string | null | undefined;
  rebasingNotice?: string;
  debugData: PrDebugData;
}

const rebasingRegex = regEx(/\*\*Rebasing\*\*: .*/);

// TODO: `branchConfig` and `config`are the same object
export function getPrBody(
  branchConfig: BranchConfig,
  prBodyConfig: PrBodyConfig,
  config: RenovateConfig,
): string {
  massageUpdateMetadata(branchConfig);
  let warnings = '';
  warnings += getWarnings(branchConfig);
  if (branchConfig.packageFiles) {
    warnings += getDepWarningsPR(
      branchConfig.packageFiles,
      config,
      branchConfig.dependencyDashboard,
    );
  }
  const content = {
    header: getPrHeader(branchConfig),
    table: getPrUpdatesTable(branchConfig),
    warnings,
    notes: getPrNotes(branchConfig) + getPrExtraNotes(branchConfig),
    changelogs: getChangelogs(branchConfig),
    configDescription: getPrConfigDescription(branchConfig),
    controls: getControls(),
    footer: getPrFooter(branchConfig),
  };

  let prBody = '';
  if (branchConfig.prBodyTemplate) {
    const prBodyTemplate = branchConfig.prBodyTemplate;
    prBody = template.compile(prBodyTemplate, content, false);
    prBody = prBody.trim();
    prBody = prBody.replace(regEx(/\n\n\n+/g), '\n\n');
    const prDebugData64 = toBase64(JSON.stringify(prBodyConfig.debugData));
    prBody += `\n<!--renovate-debug:${prDebugData64}-->\n`;
    prBody = platform.massageMarkdown(prBody, config.rebaseLabel);

    if (prBodyConfig?.rebasingNotice) {
      prBody = prBody.replace(
        rebasingRegex,
        `**Rebasing**: ${prBodyConfig.rebasingNotice}`,
      );
    }
  }
  return prBody;
}
