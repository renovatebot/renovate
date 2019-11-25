export function readOnlyIssueBody(body: string): string {
  return body
    .replace(' only once you click their checkbox below', '')
    .replace(' unless you click a checkbox below', '')
    .replace(' To discard all commits and start over, check the box below.', '')
    .replace(/ Click (?:on |)a checkbox.*\./g, '')
    .replace(/\[ ] <!-- \w*-branch.*-->/g, '');
}

export default readOnlyIssueBody;
