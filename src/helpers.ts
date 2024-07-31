function shallowCompareArray<T>(x: ReadonlyArray<T>, y: ReadonlyArray<T>): boolean {
  if (x.length !== y.length) {
    return false;
  }
  return [...Array(x.length).keys()].every((i) => x[i] === y[i]);
}

// string or number of boolean
const primitiveHead = new RegExp('^[s|n|b]');

function isPrimitive(x: unknown): boolean {
  return primitiveHead.test(typeof x);
}

/** export for test suite */
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
