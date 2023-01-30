import type { PlatformScm } from '../types';
import { commitFiles } from './';

const githubScm: Partial<PlatformScm> = {
  commitAndPush: commitFiles,
};

export default githubScm;
