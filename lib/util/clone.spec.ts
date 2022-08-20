import { clone } from './clone';

describe('util/clone', () => {
  const obj: any = {
    name: 'object',
    type: 'object',
    isObject: true,
  };

  it('maintains same order', () => {
    const res = clone(obj);
    expect(Object.keys(res)).toEqual(Object.keys(obj));
  });

  it('assigns "[Circular]" to circular references', () => {
    obj.circular = obj;
    const res = clone(obj);
    expect(res.circular).toBe('[Circular]');
  });
});
