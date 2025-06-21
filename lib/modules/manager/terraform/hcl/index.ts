import { parse } from '@cdktf/hcl2json';
import { parseJson } from '../../../../util/common';
import type { TerraformDefinitionFile } from './types';
import { terraformJsonToHcl } from './util';

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
      return await parse(
        fileName,
        terraformJsonToHcl(parseJson(content, fileName)),
      );
    } else {
      return null;
    }
  } catch /* istanbul ignore next */ {
    return null;
  }
}
