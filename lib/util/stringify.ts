import { configure } from 'safe-stable-stringify';

export const quickStringify = configure({
  deterministic: false,
});

export const safeStringify = configure({
  deterministic: true,
});
