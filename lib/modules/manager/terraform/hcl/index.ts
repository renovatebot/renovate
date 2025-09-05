import { parse } from '@cdktf/hcl2json';
import { parseJson } from '../../../../util/common';
import { TerraformDefinitionFileJSON } from './schema';
import type { TerraformDefinitionFile } from './types';

export async function parseHCL(
  content: string,
  fileName: string,
): Promise<TerraformDefinitionFile | null> {
  try {
    if (
      fileName.endsWith('.hcl') ||
      fileName.endsWith('.tf') ||
      fileName.endsWith('.tofu')
    ) {
      return await parse(fileName, content);
    } else if (
      fileName.endsWith('.hcl.json') ||
      fileName.endsWith('.tf.json') ||
      fileName.endsWith('.tofu.json')
    ) {
      return TerraformDefinitionFileJSON.parse(
        parseJson(content, fileName),
      ) as TerraformDefinitionFile;
    } else {
      return null;
    }
  } catch {
    return null;
  }
}
