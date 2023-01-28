import * as hcl_parser from 'hcl2-parser';

import type { TerraformDefinitionFile } from './types';

export function parseHCL(content: string): TerraformDefinitionFile | null {
  try {
    return hcl_parser.parseToObject(content)[0];
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

export function parseJSON(content: string): TerraformDefinitionFile | null {
  return JSON.parse(content);
}
