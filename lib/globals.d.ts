/*
 * This file should be removed in future.
 */

declare interface Error {
  validationSource?: string;

  validationError?: string;
  validationMessage?: string;
}

// make typescript happy
declare module 'source-map-support/register.js';
