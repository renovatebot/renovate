import * as hcl_parser from 'hcl2-parser';

export function parseHCL(content: string): any {
  try {
    return hcl_parser.parseToObject(content)[0];
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

export function parseJSON(content: string): any {
  return JSON.parse(content);
}
