it('succeeds', () => {});

it('fails', () => {
  throw new Error();
});

it.skip('skips', () => {
  throw new Error();
});

export {};
