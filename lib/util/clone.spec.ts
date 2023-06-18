import { clone } from './clone';

describe('util/clone', () => {
  const obj: any = {
    name: 'object',
    type: 'object',
    isObject: true,
  };

  it('returns null', () => {
    const res = clone(null);
    expect(res).toBeNull();
  });

  it('maintains same order', () => {
    const res = clone(obj);
    expect(res).toMatchSnapshot(`{
      name: 'object',
      type: 'object',
      isObject: true,
    }`);
  });

  it('assigns "[Circular]" to circular references', () => {
    obj.circular = obj;
    const res = clone(obj);
    expect(res.circular).toBe('[Circular]');
  });
});
