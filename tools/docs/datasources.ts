import { codeBlock } from 'common-tags';
import { prettier } from '../../lib/expose.ts';
import { getDatasources } from '../../lib/modules/datasource/index.ts';
import { readFile, updateFile } from '../utils/index.ts';
import type { OpenItems } from './github-query-items.ts';
import { generateFeatureAndBugMarkdown } from './github-query-items.ts';
import {
  formatDescription,
  formatUrls,
  getDisplayName,
  getModuleLink,
  replaceContent,
} from './utils.ts';

export async function generateDatasources(
  dist: string,
  datasourceIssuesMap: OpenItems,
): Promise<void> {
  const dsList = getDatasources();
  let datasourceContent = '\nSupported values for `datasource` are:\n\n';

  for (const [datasource, definition] of dsList) {
    const {
      id,
      urls,
      defaultConfig,
      customRegistrySupport,
      defaultVersioning,
      releaseTimestampSupport,
      releaseTimestampNote,
      sourceUrlSupport,
      sourceUrlNote,
    } = definition;
    const displayName = getDisplayName(datasource, definition);
    datasourceContent += `* ${getModuleLink(
      datasource,
      `\`${datasource}\``,
    )}\n`;
    let md = codeBlock`
      ---
      title: ${displayName}
      edit_url: https://github.com/renovatebot/renovate/edit/main/lib/modules/datasource/${datasource}/readme.md
      ---

      # ${displayName} Datasource
      `;
    md += '\n\n';

    let tableContent = '## Table of values\n\n';

    tableContent += '| Name | Value | Notes |\n';
    tableContent += '| :-- | :-- | :-- |\n';

    tableContent += `| Identifier | \`${id}\` | \n`;
    if (defaultVersioning) {
      tableContent += `| Default versioning | \`${defaultVersioning}\` | \n`;
    } else {
      tableContent += `| Default versioning | No default versioning | \n`;
    }

    tableContent += `| Custom registry support | ${customRegistrySupport ? 'Yes' : 'No'} | \n`;
    tableContent += `| Release timestamp support | ${releaseTimestampSupport ? 'Yes' : 'No'} | ${releaseTimestampNote ?? ''} |\n`;
    tableContent += `| Source URL support | ${sourceUrlSupport === 'none' ? 'No' : 'Yes'} | ${sourceUrlNote ?? ''} |\n`;

    md += `${tableContent}\n`;
    md += formatUrls(urls);
    md += await formatDescription('datasource', datasource);

    if (defaultConfig) {
      md += `## Default configuration\n\n\`\`\`json\n${JSON.stringify(defaultConfig, undefined, 2)}\n\`\`\`\n`;
    }

    md += generateFeatureAndBugMarkdown(datasourceIssuesMap, datasource);

    await updateFile(`${dist}/modules/datasource/${datasource}/index.md`, md);
  }

  let indexContent = await readFile(`docs/usage/modules/datasource/index.md`);
  indexContent = replaceContent(indexContent, datasourceContent);
  await updateFile(`${dist}/modules/datasource/index.md`, indexContent);
}

// TODO #43685
export async function generateCustomDatasourcesJsonSchema(
  dist: string,
  version: string,
): Promise<void> {
  const filename = 'renovate-custom-datasources-response-schema.json';
  const schema = {
    $id: `https://docs.renovatebot.com/${filename}`,
    title: `JSON schema for Custom Datasource responses expected by Renovate ${version} (https://renovatebot.com/)`,
    $schema: 'http://json-schema.org/draft-07/schema#',
    'x-renovate-version': `${version}`,
    allowComments: true,
    type: 'object',
    required: ['releases'],
    properties: {
      releases: {
        type: 'array',
        description:
          'The list of releases for this dependency. Renovate uses this to determine what versions are available and whether updates are needed.',
        items: {
          type: 'object',
          required: ['version'],
          properties: {
            version: {
              type: 'string',
              description:
                'The version string for this release. Must be parseable by the configured versioning scheme.',
            },
            isDeprecated: {
              type: 'boolean',
              description:
                'Whether this version is deprecated.\n\nRenovate avoids updating to deprecated dependencies, and will report usage of deprecated dependencies in the Dependency Dashboard',
            },
            releaseTimestamp: {
              type: ['string', 'number', 'null'],
              description:
                'The release date-time for this version.\n\nAccepts ISO 8601 strings, HTTP dates, SQL dates, Unix timestamps (seconds or milliseconds), or null. Must be after 2000-01-01 and not in the future.',
            },
            sourceUrl: {
              type: 'string',
              description:
                'URL to the source code repository for this specific release version, if different from the top-level sourceUrl.',
            },
            sourceDirectory: {
              type: 'string',
              description:
                'Subdirectory within the source repository where this release lives. Used together with sourceUrl when the package is not at the repository root.',
            },
            changelogUrl: {
              type: 'string',
              description:
                'URL to the changelog or release notes for this specific version.',
            },
            digest: {
              type: 'string',
              description:
                'An immutable digest (e.g. a SHA256 hash) that uniquely identifies the release artifact.',
            },
            isStable: {
              type: 'boolean',
              description: `Whether this release is a stable (whether this is not a pre-release version).

                If omitted, Renovate will assume isStable=true.

                See \`ignoreUnstable\` (https://docs.renovatebot.com/configuration-options/#ignoreunstable) for more details.`,
              markdownDescription: `Whether this release is a stable (whether this is not a pre-release version).

                If omitted, Renovate will assume isStable=true.

                See [\`ignoreUnstable\`](https://docs.renovatebot.com/configuration-options/#ignoreunstable) for more details.`,
            },
          },
          additionalProperties: false,
        },
      },
      tags: {
        type: 'object',
        description:
          'A map of tag names (e.g. "latest", "stable") to version strings. Allows Renovate to resolve symbolic tags when a dependency is pinned to a tag rather than an explicit version.',
        additionalProperties: {
          type: 'string',
        },
      },
      sourceUrl: {
        type: 'string',
        description:
          'URL to the source code repository for this dependency (e.g. a GitHub repo).\n\nRenovate uses this to look up changelogs and release notes.',
      },
      sourceDirectory: {
        type: 'string',
        description:
          'Subdirectory within the source repository where the dependency lives.\n\nUsed together with sourceUrl when the package is not at the repository root.',
      },
      changelogUrl: {
        type: 'string',
        description:
          'URL to the changelog or release notes for this dependency.',
      },
      homepage: {
        type: 'string',
        description: "URL to the dependency's homepage or documentation site.",
      },
    },
    additionalProperties: false,
  };

  const out = await prettier().format(JSON.stringify(schema), {
    filepath: filename,
  });

  await updateFile(`${dist}/${filename}`, `${out}\n`);
}
