import { regEx } from '../../../util/regex';

export function readOnlyIssueBody(body: string): string {
  return body
    .replace(regEx(/ To.*?, click on a checkbox below\./g), '')
    .replace(regEx(/\[ ] <!-- \w*-branch.*-->/g), '')
    .replace(regEx(/- \[ ] <!-- rebase-all-open-prs -->.*/g), '')
    .replace(regEx(/ - \[ ] <!-- create-all-rate-limited-prs -->.*/g), '');
}

export default readOnlyIssueBody;
