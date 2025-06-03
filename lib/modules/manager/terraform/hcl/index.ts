import { parse } from '@cdktf/hcl2json';
import type { TerraformDefinitionFile } from './types';

export async function parseHCL(
  content: string,
  fileName: string,
): Promise<TerraformDefinitionFile | null> {
  try {
    if (fileName.endsWith('.tf') || fileName.endsWith('.hcl')) {
      return await parse(fileName, content);
    } else if (
      fileName.endsWith('.tf.json') ||
      fileName.endsWith('.hcl.json')
    ) {
      return parseJSON(content);
    } else {
      return null;
    }
  } catch /* istanbul ignore next */ {
    return null;
  }
}

export function parseJSON(content: string): TerraformDefinitionFile | null {
  return JSON.parse(content);
}
