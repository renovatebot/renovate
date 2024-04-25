import { parse } from '@cdktf/hcl2json';
import type { TerraformDefinitionFile } from './types';

export async function parseHCL(
  content: string,
  fileName: string,
): Promise<TerraformDefinitionFile | null> {
  try {
    return await parse(fileName, content);
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

export function parseJSON(content: string): TerraformDefinitionFile | null {
  return JSON.parse(content);
}
