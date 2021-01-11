import { getName } from '../../test/util';
import { parse } from './html';

describe(getName(__filename), () => {
  it('parses HTML', () => {
    const body = parse('<div>Hello, world!</div>');
    expect(body.childElementCount).toBe(1);
    const div = body.children[0];
    expect(div.tagName).toBe('DIV');
    expect(div.textContent).toBe('Hello, world!');
  });
  it('returns empty', () => {
    const body = parse('');
    expect(body.childElementCount).toBe(0);
  });
});
