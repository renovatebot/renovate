import { getName } from '../../test/util';
import { HTMLElement, parse } from './html';

describe(getName(__filename), () => {
  it('parses HTML', () => {
    const body = parse('<div>Hello, world!</div>');
    expect(body.childNodes).toHaveLength(1);
    const div = body.childNodes[0] as HTMLElement;
    expect(div.tagName).toBe('DIV');
    expect(div.textContent).toBe('Hello, world!');
    expect(div instanceof HTMLElement).toBe(true);
  });
  it('returns empty', () => {
    const body = parse('');
    expect(body.childNodes).toHaveLength(0);
  });
});
