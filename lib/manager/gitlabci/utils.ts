// !reference [.setup, script]
const re = /!reference \[\.\w+?(?:, \w+?)\]/g;

/**
 * Replaces gitlab reference tags before parsing, because we our yaml parser doesn't support that.
 * @param content pipeline yaml
 * @returns replaced pipeline content
 * https://docs.gitlab.com/ee/ci/yaml/#reference-tags
 */
export function replaceReferenceTags(content: string): string {
  const res = content.replace(re, '');
  return res;
}
