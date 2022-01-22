import * as hcl_parser from 'hcl2-parser';

export function parseHCL(content: string): any {
  return hcl_parser.parseToObject(content)[0];
}

export function parseJSON(content: string): any {
  return JSON.parse(content);
}
