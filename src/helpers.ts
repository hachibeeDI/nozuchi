function shallowCompareArray<T>(x: ReadonlyArray<T>, y: ReadonlyArray<T>): boolean {
  if (x.length !== y.length) {
    return false;
  }
  return [...Array(x.length).keys()].every((i) => x[i] === y[i]);
}

/** @internal */
export function isPrimitive(x: unknown): boolean {
  const t = typeof x;
  return t !== 'object' && t !== 'function';
}

/**
 * Compares two values with shallow equality.
 *
 * - **Primitives** (`string`, `number`, `boolean`, `undefined`, `symbol`, `bigint`)
 *   and `null` are compared with `Object.is`.
 * - **Arrays** are compared element-by-element with `===` (one level deep).
 * - **Plain objects** are compared key-by-key with `Object.is` (one level deep).
 *   Nested arrays within object values are themselves compared shallowly.
 *
 * Used as the default equality function for `useSelector`, so returning a
 * freshly constructed object or array from a selector does not cause
 * unnecessary re-renders as long as its contents are reference-equal.
 *
 * @example
 * shallowCompare('a', 'a');                     // true
 * shallowCompare([1, 2], [1, 2]);               // true  — same elements
 * shallowCompare({a: 1, b: 2}, {a: 1, b: 2});  // true  — same keys & values
 * shallowCompare({a: {b: 1}}, {a: {b: 1}});    // false — nested objects are not deep-compared
 */
export function shallowCompare<T>(x: T, y: T): boolean {
  if (Object.is(x, y)) {
    return true;
  }
  if (x == null || isPrimitive(x)) {
    return Object.is(x, y);
  }

  if (Array.isArray(x) && Array.isArray(y)) {
    return shallowCompareArray(x, y);
  }

  const xKeys = Object.keys(x);
  const yKeys = y == null ? [] : Object.keys(y);
  const keyDiff = shallowCompareArray(xKeys, yKeys);
  if (keyDiff === false) {
    return false;
  }

  return xKeys.every((k) => {
    const xc = (x as any)[k];
    const yc = (y as any)[k];
    if (Array.isArray(xc) && Array.isArray(yc)) {
      return shallowCompareArray(xc, yc);
    }
    return Object.is(xc, yc);
  });
}
