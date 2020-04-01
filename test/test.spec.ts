it('succeeds', () => {});

it.skip('skips', () => {
  throw new Error();
});

it('fails', () => {
  expect(true).toBe(false);
});

export {};
