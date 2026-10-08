import type { LfsState } from './lfs.ts';

export function newLfsState(): LfsState {
  return {
    mode: 'disabled',
    active: false,
    endpoint: null,
    authEndpoint: null,
    include: [],
    authenticated: false,
  };
}

let lfsState: LfsState = newLfsState();

export function getLfsState(): LfsState {
  return lfsState;
}

export function setLfsState(state: LfsState): void {
  lfsState = state;
}

export function isGitLfsActive(): boolean {
  return lfsState.active;
}
