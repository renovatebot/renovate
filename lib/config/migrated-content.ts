import type { Indent } from 'detect-indent';
import detectIndent from 'detect-indent';
import JSON5 from 'json5';
import { weave } from 'jsonc-weaver';
import { logger } from '../logger/index.ts';
import type { RenovateConfig } from './types.ts';

export interface MigratedContent {
  content: string;
  indent: Indent;
}

function stringifyConfig(
  filename: string,
  config: RenovateConfig,
  indentSpace: string,
): string {
  if (filename.endsWith('.json5')) {
    return JSON5.stringify(config, undefined, indentSpace);
  }
  return JSON.stringify(config, undefined, indentSpace);
}

/**
 * Serializes a migrated config for `filename`, preserving the comments and indentation of its `raw` content where possible.
 */
export function stringifyMigratedConfig(
  filename: string,
  raw: string | null,
  migratedConfig: RenovateConfig,
): MigratedContent {
  const indent = detectIndent(raw ?? '');
  // indent defaults to 2 spaces
  const indentSpace = indent.indent ?? '  ';
  let content: string;

  if (raw) {
    try {
      content = weave(raw, migratedConfig);
    } catch (err) {
      logger.warn(
        { err },
        'Error weaving config to preserve comments, falling back to rewriting the whole file',
      );
      content = stringifyConfig(filename, migratedConfig, indentSpace);
    }
  } else {
    content = stringifyConfig(filename, migratedConfig, indentSpace);
  }

  if (!content.endsWith('\n')) {
    content += '\n';
  }

  return { content, indent };
}
