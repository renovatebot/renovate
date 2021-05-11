import { platform } from '../../../platform';
import * as template from '../../../util/template';
import { get } from '../../../versioning';
import type { BranchConfig } from '../../types';
import { getChangelogs } from './changelogs';
import { getPrConfigDescription } from './config-description';
import { getControls } from './controls';
import { getPrFooter } from './footer';
import { getPrHeader } from './header';
import { getPrExtraNotes, getPrNotes } from './notes';
import { getPrUpdatesTable } from './updates-table';

function massageUpdateMetadata(config: BranchConfig): void {
  config.upgrades.forEach((upgrade) => {
    /* eslint-disable no-param-reassign */
    const {
      homepage,
      sourceUrl,
      sourceDirectory,
      changelogUrl,
      dependencyUrl,
    } = upgrade;
    let depNameLinked = upgrade.depName;
    const primaryLink = homepage || sourceUrl || dependencyUrl;
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
        fullUrl =
          sourceUrl.replace(/\/?$/, '/') +
          'tree/HEAD/' +
          sourceDirectory.replace('^/?/', '');
      }
      references.push(`[source](${fullUrl})`);
    }
    if (changelogUrl) {
      references.push(`[changelog](${changelogUrl})`);
    }
    upgrade.references = references.join(', ');
    const { currentVersion, newVersion, updateType, versioning } = upgrade;
    // istanbul ignore if
    if (updateType === 'minor') {
      try {
        const version = get(versioning);
        if (version.getMinor(currentVersion) === version.getMinor(newVersion)) {
          upgrade.updateType = 'patch';
        }
      } catch (err) {
        // do nothing
      }
    }
    /* eslint-enable no-param-reassign */
  });
}

export async function getPrBody(config: BranchConfig): Promise<string> {
  massageUpdateMetadata(config);
  const content = {
    header: getPrHeader(config),
    table: getPrUpdatesTable(config),
    notes: getPrNotes(config) + getPrExtraNotes(config),
    changelogs: getChangelogs(config),
    configDescription: await getPrConfigDescription(config),
    controls: await getControls(config),
    footer: getPrFooter(config),
  };
  const prBodyTemplate = config.prBodyTemplate;
  let prBody = template.compile(prBodyTemplate, content, false);
  prBody = prBody.trim();
  prBody = prBody.replace(/\n\n\n+/g, '\n\n');
  prBody = platform.massageMarkdown(prBody);
  return prBody;
}
