import { regEx } from '../../../util/regex';

export function readOnlyIssueBody(body: string): string {
  return body
    .replace(regEx(/ To.*?, click on a checkbox below\./g), '')
    .replace(regEx(/\[ ] <!-- \w*-branch.*-->/g), '')
    .replace(regEx(/- \[ ] <!-- rebase-all-open-prs -->.*/g), '')
    .replace(regEx(/- \[ ] <!-- approve-[\w-]*-prs -->.*/g), '')
    .replace(regEx(/- \[ ] <!-- create-[\w-]*-(pr|prs) -->.*/g), '');
}

export default readOnlyIssueBody;
