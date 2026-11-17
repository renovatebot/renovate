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

  if (filename.endsWith('.json5')) {
    content = JSON5.stringify(migratedConfig, undefined, indentSpace);
  } else if (raw) {
    try {
      content = weave(raw, migratedConfig);
    } catch (err) {
      logger.warn(
        { err },
        'Error weaving JSONC to preserve comments, falling back to JSON.stringify',
      );
      content = JSON.stringify(migratedConfig, undefined, indentSpace);
    }
  } else {
    content = JSON.stringify(migratedConfig, undefined, indentSpace);
  }

  if (!content.endsWith('\n')) {
    content += '\n';
  }

  return { content, indent };
}
