import { regEx } from '../../../util/regex';

export function readOnlyIssueBody(body: string): string {
  return body
    .replace(regEx(/ To.*?, click on a checkbox below\./g), '')
    .replace(regEx(/\[ ] <!-- \w*-branch.*-->/g), '')
    .replace(regEx(/ - \[ ] <!-- create-config-migration-pr -->.*/g), '')
    .replace(regEx(/ - \[ ] <!-- approve-all-[\w-]*-prs -->.*/g), '')
    .replace(regEx(/ - \[ ] <!-- create-all-[\w-]*-prs -->.*/g), '')
    .replace(regEx(/ - \[ ] <!-- rebase-all-[\w-]*-prs -->.*/g), '');
}

export default readOnlyIssueBody;
