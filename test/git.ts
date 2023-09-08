import { mockDeep } from 'vitest-mock-extended';
import * as _git from '../lib/util/git';

vi.mock('../lib/util/git', () => mockDeep());

export const git = vi.mocked(_git);
