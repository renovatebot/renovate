import { regEx } from '../../../util/regex';

export function readOnlyIssueBody(body: string): string {
  return body
    .replace(' only once you select their checkbox below', '')
    .replace(' unless you select a checkbox below', '')
    .replace(' To discard all commits and start over, select a checkbox.', '')
    .replace(regEx(/ Select (?:on |)a checkbox.*\./g), '')
    .replace(regEx(/\[ ] <!-- \w*-branch.*-->/g), '');
}

export default readOnlyIssueBody;
