import type { ManagerApi } from '../types';
import * as regex from './regex';

const api = new Map<string, ManagerApi>();
export default api;

api.set('regex', regex);
