import { HTMLElement, Options, parse as _parse } from 'node-html-parser';

export { HTMLElement };

export function parse(html: string, config?: Partial<Options>): HTMLElement {
  if (typeof config !== 'undefined') {
    return _parse(html, config);
  }

  return _parse(html);
}
