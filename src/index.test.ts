import {describe, test, expect, vi} from 'vitest';

import {createStore} from './index';
import {shallowCompare} from './helpers';

describe('Store', () => {
  test('is subscribable', () => {
    const initialState = {a: 'a', b: 'b'};
    const store = createStore(initialState, {
      handleAChanged: (newA: string) => (s) => ({...s, a: newA}),
    });

    const confirmAWasChanged = vi.fn((s: typeof initialState) => {
      expect(s.a).toBe('newA');
    });

    store.subscribe(confirmAWasChanged);

    store.actions.handleAChanged('newA');

    expect(confirmAWasChanged).toBeCalledTimes(1);
  });

  test('is subscribable with async method', () => {
    const initialState = {a: 'a', b: 'b'};
    const store = createStore(initialState, {
      handleAChangedAsync: (newA: string) => async (prev) =>
        await new Promise((resolve) => {
          setTimeout(() => resolve({...prev, a: newA}), 1);
        }),
    });

    return new Promise((resolve) => {
      const confirmAWasChanged = vi.fn((s: typeof initialState) => {
        expect(s.a).toBe('newA async');
        resolve(undefined);
      });

      store.subscribe(confirmAWasChanged);

      store.actions.handleAChangedAsync('newA async');
    });
  });

  test('can handle event by middleware', () => {
    const initialState = {a: 'a', b: 'b'};
    const store = createStore(
      initialState,
      {
        handleChange: (newA: string, newB: string) => (s) => ({...s, a: newA, b: newB}),
      },
      {
        onInit: (s) => ({a: `${s.a}!!!`, b: `${s.b}!`}),
        onUpdate: (newS, prevS) => ({a: `${prevS.a}->${newS.a}`, b: `${prevS.b}->${newS.b}`}),
      },
    );
    expect(store.getState()).toStrictEqual({a: 'a!!!', b: 'b!'});

    store.actions.handleChange('newA', 'newB');
    expect(store.getState()).toStrictEqual({a: 'a!!!->newA', b: 'b!->newB'});
  });
});

describe('shallowCompare', () => {
  test('shallowCompare works fine', () => {
    expect(shallowCompare('abc', 'abc')).toBe(true);
    expect(shallowCompare(123, 123)).toBe(true);
    expect(shallowCompare(null, null)).toBe(true);
    expect(shallowCompare(undefined, undefined)).toBe(true);
    expect(shallowCompare(null, undefined)).toBe(false);
    expect(shallowCompare(NaN, NaN)).toBe(true);

    expect(shallowCompare(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(
      shallowCompare(
        {
          a: 'a',
          b: 'b',
          c: 'c',
          d: [123, 4],
        },
        {
          a: 'a',
          b: 'b',
          c: 'c',
          d: [123, 4],
        },
      ),
    ).toBe(true);
  });
});
