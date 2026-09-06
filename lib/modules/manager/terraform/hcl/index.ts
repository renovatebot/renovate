import { parse } from '@cdktf/hcl2json';
import { logger } from '../../../../logger/index.ts';
import { parseJson } from '../../../../util/common.ts';
import { TerraformDefinitionFile } from './schema.ts';

export async function parseHCL(
  content: string,
  fileName: string,
): Promise<TerraformDefinitionFile | null> {
  try {
    if (fileName.endsWith('.tf') || fileName.endsWith('.tofu')) {
      return TerraformDefinitionFile.parse(await parse(fileName, content));
    }
    if (fileName.endsWith('.tf.json') || fileName.endsWith('.tofu.json')) {
      return TerraformDefinitionFile.parse(parseJson(content, fileName));
    }

    return null;
  } catch (err) {
    logger.debug({ err, packageFile: fileName }, 'HCL parse error');
    return null;
  }
}
