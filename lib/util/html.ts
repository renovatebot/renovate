import _parse, { HTMLElement, Options } from 'node-html-parser';

export type { HTMLElement };

export function parse(html: string, config?: Partial<Options>): HTMLElement {
  if (typeof config !== 'undefined') {
    return _parse(html, config);
  }

  return _parse(html);
}
