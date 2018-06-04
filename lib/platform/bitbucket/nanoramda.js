// CURRY
const curry = fn => (...args) =>
  args.length < fn.length
    ? (...rest) => curry(fn)(...args, ...rest)
    : fn(...args);

// COMPOSITION
const pipe = (headFN, ...restFns) => (...args) =>
  restFns.reduce((value, fn) => fn(value), headFN(...args));
const compose = (...fns) => pipe(...fns.reverse());

// ASYNC COMPOSITION
const pipeP = (headPromiseFn, ...restPromiseFns) => (...args) =>
  restPromiseFns.reduce(
    (promiseValue, promiseFn) => promiseValue.then(promiseFn),
    headPromiseFn(...args)
  );
const composeP = (...fns) => pipeP(...fns.reverse());

// COLLECTIONS
const length = xs => (xs || []).length;
const map = curry((fn, xs) => (xs || []).map(fn));
const reduce = curry((fn, initial, xs) => (xs || []).reduce(fn, initial));
const filter = curry((fn, xs) => (xs || []).filter(fn));
const reject = curry((fn, xs) => (xs || []).filter(item => !fn(item)));
const contains = curry((xs, x) => (xs || []).includes(x));
const concat = curry((xs, ys) => (xs || []).concat(ys));
const unnest = reduce(concat, []);
const reverse = xs => [...(xs || [])].reverse();
const head = ([x] = []) => x;
const tail = ([, ...xs] = []) => xs;
const init = pipe(reverse, tail, reverse);
const last = xs => xs[xs.length - 1];
const uniq = (xs = []) => [...new Set(xs)];

// OBJECT
const { keys, values } = Object;
const clone = (x = {}) => ({ ...x });
const merge = curry((x, y) => Object.assign({}, x, y));
const prop = curry((key, obj) => (obj || {})[key]);
const pick = curry((ks, obj) =>
  (ks || []).reduce((acc, key) => merge(acc, { [key]: obj[key] }), {})
);
const propEq = curry((key, val, obj) => (obj || {})[key] === val);
const dissoc = curry((key, obj) => {
  const newObj = { ...obj };
  delete newObj[key];
  return newObj;
});
const path = curry((ks, obj) => ks.reduce((acc = {}, x) => acc[x], obj));
const zipObj = (ks, vs) =>
  ks.reduce(
    (acc, key) => merge(acc, { [key]: vs[ks.findIndex(x => x === key)] }),
    {}
  );
const awaitValues = o =>
  pipeP(pResolve, values, pAll, vs => zipObj(keys(o), vs))(o);

// LOGIC
const T = () => true;
const F = () => false;
const ifElse = curry(
  (pred, onTrue, onFalse, x) => (pred(x) ? onTrue(x) : onFalse(x))
);
const when = curry(
  (pred, transformer, x) => (pred(x) ? transformer(x) : id(x))
);
const until = curry(
  (pred, transformer, x) => (!pred(x) ? id(x) : transformer(x))
);
const cond = curry((conds, x) => {
  const [, transformer] = conds.find(([pred]) => pred(x));
  return transformer ? transformer(x) : undefined;
});

// PROMISES
const pResolve = Promise.resolve.bind(Promise);
const pReject = Promise.reject.bind(Promise);
const pAll = Promise.all.bind(Promise);

// STRINGS
const startsWith = curry((substr, str) => str.startsWith(substr));

// MISC
const tap = curry((fn, x) => {
  fn(x);
  return x;
});
const id = x => x;
const always = x => () => x;
const flip = curry((fn, x, y) => fn(y, x));

// JSON
const jsonParse = x => JSON.parse(x);
const jsonStringify = x => JSON.stringify(x, null, 2);

// DEBUG
const log = console.log.bind(console); // eslint-disable-line no-console
const err = console.error.bind(console); // eslint-disable-line no-console
const debug = tap(console.log); // eslint-disable-line no-console
const debugJson = tap(pipe(jsonStringify, log));

// DEFAULT EXPORT
module.exports = {
  // CURRY
  curry,

  // COMPOSITION
  pipe,
  compose,

  // ASYNC COMPOSITION
  pipeP,
  composeP,

  // COLLECTIONS
  length,
  map,
  reduce,
  filter,
  reject,
  contains,
  concat,
  unnest,
  reverse,
  head,
  tail,
  init,
  last,
  uniq,

  // OBJECT
  keys,
  values,
  clone,
  merge,
  prop,
  pick,
  propEq,
  dissoc,
  path,
  zipObj,
  awaitValues,

  // LOGIC
  T,
  F,
  ifElse,
  when,
  until,
  cond,

  // PROMISES
  pResolve,
  pReject,
  pAll,

  // STRINGS
  startsWith,

  // MISC
  tap,
  id,
  always,
  flip,

  // JSON
  jsonParse,
  jsonStringify,

  // DEBUG
  log,
  err,
  debug,
  debugJson,
};
