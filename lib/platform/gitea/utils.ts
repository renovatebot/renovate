export function smartLinks(body: string): string {
  return body?.replace(/\]\(\.\.\/pull\//g, '](pulls/');
}
