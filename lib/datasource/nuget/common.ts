import { regEx } from '../../util/regex';

export const id = 'nuget';

const buildMetaRe = regEx(/\+.+$/g);
const urlWhitespaceRe = regEx(/\s/g);

export function removeBuildMeta(version: string): string {
  return version?.replace(buildMetaRe, '');
}

export function massageUrl(url: string): string {
  let resultUrl = url;

  // During `dotnet pack` certain URLs are being URL decoded which may introduce whitespaces
  // and causes Markdown link generation problems.
  resultUrl = resultUrl?.replace(urlWhitespaceRe, '%20');

  return resultUrl;
}
