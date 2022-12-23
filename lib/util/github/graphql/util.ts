export function prepareQuery(payloadQuery: string): string {
  return `
    query($owner: String!, $name: String!, $cursor: String, $count: Int!) {
      repository(owner: $owner, name: $name) {
        isRepoPrivate: isPrivate
        payload: ${payloadQuery}
      }
    }
  `;
}
