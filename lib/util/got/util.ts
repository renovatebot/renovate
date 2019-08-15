import got from 'got';
import { Got } from './common';

// TODO: missing types
export const mergeInstances = (got as any).mergeInstances as (
  ...args: (got.GotInstance<any>)[]
) => Got;

// TODO: missing types
export const create = (got as any).create as (defaults: {
  options: any;
  handler: Function;
}) => got.GotInstance;
