import type { RenovateConfig } from '../../../../../config/types';
import { PrDebugData, platform } from '../../../../../modules/platform';
import { regEx } from '../../../../../util/regex';
import { toBase64 } from '../../../../../util/string';
import * as template from '../../../../../util/template';
import { joinUrlParts } from '../../../../../util/url';
import type { BranchConfig } from '../../../../types';
import { getDepWarningsPR, getWarnings } from '../../../errors-warnings';
import { getChangelogs } from './changelogs';
import { getPrConfigDescription } from './config-description';
import { getControls } from './controls';
import { getPrFooter } from './footer';
import { getPrHeader } from './header';
import { getPrExtraNotes, getPrNotes } from './notes';
import { getPrUpdatesTable } from './updates-table';

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
    const primaryLink = homepage ?? sourceUrl ?? dependencyUrl;
    if (primaryLink) {
      depNameLinked = `[${depNameLinked}](${primaryLink})`;
    }
    const otherLinks = [];
    if (homepage && sourceUrl) {
      otherLinks.push(`[source](${sourceUrl})`);
    }
    if (changelogUrl) {
      otherLinks.push(`[changelog](${changelogUrl})`);
    }
    if (otherLinks.length) {
      depNameLinked += ` (${otherLinks.join(', ')})`;
    }
    upgrade.depNameLinked = depNameLinked;
    const references: string[] = [];
    if (homepage) {
      references.push(`[homepage](${homepage})`);
    }
    if (sourceUrl) {
      let fullUrl = sourceUrl;
      if (sourceDirectory) {
        fullUrl = joinUrlParts(sourceUrl, 'tree/HEAD/', sourceDirectory);
      }
      references.push(`[source](${fullUrl})`);
    }
    if (changelogUrl) {
      references.push(`[changelog](${changelogUrl})`);
    }
    upgrade.references = references.join(', ');
  });
}

interface PrBodyConfig {
  appendExtra?: string | null | undefined;
  rebasingNotice?: string;
  debugData: PrDebugData;
}

const rebasingRegex = regEx(/\*\*Rebasing\*\*: .*/);

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
    prBody = platform.massageMarkdown(prBody);

    if (prBodyConfig?.rebasingNotice) {
      prBody = prBody.replace(
        rebasingRegex,
        `**Rebasing**: ${prBodyConfig.rebasingNotice}`,
      );
    }
  }
  return prBody;
}
