import { parse } from '@cdktf/hcl2json';
import { logger } from '../../../../logger/index.ts';
import { parseJson } from '../../../../util/common.ts';
import { TerraformDefinitionFileJSON } from './schema.ts';
import type { TerraformDefinitionFile } from './types.ts';

export async function parseHCL(
  content: string,
  fileName: string,
): Promise<TerraformDefinitionFile | null> {
  try {
    if (
      (fileName.endsWith('.hcl') && !fileName.endsWith('.lock.hcl')) ||
      fileName.endsWith('.tf') ||
      fileName.endsWith('.tofu')
    ) {
      return await parse(fileName, content);
    } else if (
      fileName.endsWith('.hcl.json') ||
      fileName.endsWith('.tf.json') ||
      fileName.endsWith('.tofu.json')
    ) {
      return TerraformDefinitionFileJSON.parse(parseJson(content, fileName));
    } else {
      return null;
    }
  } catch (err) {
    logger.debug({ err, packageFile: fileName }, 'HCL parse error');
    return null;
  }
}
