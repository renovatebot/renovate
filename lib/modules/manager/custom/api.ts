import type { ManagerApi } from '../types';
import * as jsonata from './jsonata';
import * as regex from './regex';

const api = new Map<string, ManagerApi>();
export default api;

api.set('regex', regex);
api.set('jsonata', jsonata);
