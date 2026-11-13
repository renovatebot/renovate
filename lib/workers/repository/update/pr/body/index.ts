import type { RenovateConfig } from '../../../../../config/types.ts';
import { PLATFORM_FAMILIES } from '../../../../../constants/index.ts';
import { logger } from '../../../../../logger/index.ts';
import type { PrDebugData } from '../../../../../modules/platform/index.ts';
import { platform } from '../../../../../modules/platform/index.ts';
import {
  fitSections,
  getBodyLength,
} from '../../../../../modules/platform/utils/pr-body.ts';
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

    const sourcePlatform = sourceUrl ? detectPlatform(sourceUrl) : null;
    const sourceRootPath = sourcePlatform
      ? PLATFORM_FAMILIES[sourcePlatform].webDirPath
      : 'tree/HEAD';

    const otherLinks = [];
    const hasSourceDirectoryOrHomepage = !!sourceDirectory || homepage;
    if (sourceUrl && hasSourceDirectoryOrHomepage) {
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

interface PrBodyContent extends Record<string, string> {
  notes: string;
  changelogs: string;
}

function compilePrBody(
  prBodyTemplate: string,
  content: PrBodyContent,
  debugData: PrDebugData,
): string {
  let prBody = template.compile(prBodyTemplate, content, false);
  prBody = prBody.trim();
  prBody = prBody.replace(regEx(/\n\n\n+/g), '\n\n');
  const prDebugData64 = toBase64(JSON.stringify(debugData));
  return `${prBody}\n<!--renovate-debug:${prDebugData64}-->\n`;
}

function massagePrBody(
  compiledBody: string,
  prBodyConfig: PrBodyConfig,
  rebaseLabel: string | undefined,
): string {
  let prBody = platform.massageMarkdown(compiledBody, rebaseLabel);

  if (prBodyConfig.rebasingNotice) {
    prBody = prBody.replace(
      rebasingRegex,
      `**Rebasing**: ${prBodyConfig.rebasingNotice}`,
    );
  }
  return prBody;
}

/**
 * Cuts the `changelogs` and `notes` sections, changelogs first, until the rendered body is short enough for the platform. All other sections are kept.
 */
function fitContentToLimit(
  prBodyTemplate: string,
  content: PrBodyContent,
  prBodyConfig: PrBodyConfig,
  rebaseLabel: string | undefined,
): PrBodyContent {
  const maxLength = platform.maxBodyLength();
  const fitted = fitSections(
    content,
    ['notes', 'changelogs'],
    (sections) =>
      getBodyLength(
        compilePrBody(prBodyTemplate, sections, prBodyConfig.debugData),
        (compiledBody) =>
          massagePrBody(compiledBody, prBodyConfig, rebaseLabel),
        maxLength,
      ),
    maxLength,
  );
  if (fitted !== content) {
    logger.debug(
      `Truncated PR body sections due to platform limitation of ${maxLength} characters`,
    );
  }
  return fitted;
}

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
      branchConfig.dependencyDashboard?.enabled,
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
    const { prBodyTemplate } = branchConfig;
    const fittedContent = fitContentToLimit(
      prBodyTemplate,
      content,
      prBodyConfig,
      config.rebaseLabel,
    );
    prBody = massagePrBody(
      compilePrBody(prBodyTemplate, fittedContent, prBodyConfig.debugData),
      prBodyConfig,
      config.rebaseLabel,
    );
  }
  return prBody;
}
