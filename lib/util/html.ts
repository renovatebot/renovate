// import { JSDOM } from 'jsdom';
import { HTMLElement, parse as _parse } from 'node-html-parser';

export { HTMLElement };

export function parse(html: string): HTMLElement {
  return _parse(html);
  // return new JSDOM(html).window.document.body;
}
