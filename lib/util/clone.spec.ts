import { clone } from './clone';

describe('util/clone', () => {
  it('returns null', () => {
    const res = clone(null);
    expect(res).toBeNull();
  });

  it('maintains same order', () => {
    const obj: any = {
      name: 'object',
      type: 'object',
      isObject: true,
    };

    const res = clone(obj);

    expect(res).toMatchSnapshot(`{
      name: 'object',
      type: 'object',
      isObject: true,
    }`);
  });

  it('assigns "[Circular]" to circular references', () => {
    const obj: any = {
      name: 'object',
      type: 'object',
      isObject: true,
    };
    obj.circular = obj;

    expect(() => clone(obj)).toThrow('Circular reference detected');
  });
});
