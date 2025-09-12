import { regEx } from '../../../util/regex';

export function readOnlyIssueBody(body: string): string {
  return (
    body
      .replace(regEx(/ To.*?, click on a checkbox below\./g), '')
      .replace(regEx(/\[ ] <!-- \w*-branch.*-->/g), '')
      .replace(regEx(/- \[ ] <!-- rebase-all-open-prs -->.*/g), '')
      .replace(regEx(/ - \[ ] <!-- create-all-rate-limited-prs -->.*/g), '')
      // Remove config migration checkbox and related text
      .replace(regEx(/ - \[ ] <!-- create-config-migration-pr -->.*/g), '')
      .replace(
        regEx(
          / - \[ ]\s+Select this checkbox to let Renovate create an automated Config Migration PR\./g,
        ),
        '',
      )
  );
}

export default readOnlyIssueBody;
