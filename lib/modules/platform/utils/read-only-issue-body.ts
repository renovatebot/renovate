import { regEx } from '../../../util/regex';

export function readOnlyIssueBody(body: string): string {
  return body
    .replace(' only once you click their checkbox below', '')
    .replace(' unless you click a checkbox below', '')
    .replace(' To discard all commits and start over, click on a checkbox.', '')
    .replace(regEx(/ Click (?:on |)a checkbox.*\./g), '')
    .replace(regEx(/\[ ] <!-- \w*-branch.*-->/g), '');
}

export default readOnlyIssueBody;
