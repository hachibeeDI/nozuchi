import {describe, test, expect, vi} from 'vitest';

import {createStore} from './index';
import {shallowCompare} from './helpers';
import {Observable} from './observable';

const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time)); //timeはミリ秒

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
      handleAChangedAsync: (newA: string) => async (prev) => {
        await sleep(1);
        return {...prev, a: newA};
      },
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

  test('is subscribable with observable method', async () => {
    const initialState = {a: 'a', b: 'b'};
    type TestState = typeof initialState;
    const store = createStore(initialState, {
      handleAChangedStream: (watcher: () => void) => (_prev) =>
        new Observable<(s: TestState) => TestState>(async (obs) => {
          await sleep(1);
          obs.next((current) => ({...current, a: `${current.a}-${initialState.a}`}));
          await sleep(1);
          obs.next((current) => ({...current, a: `${current.a}-${initialState.a}`}));
          await sleep(1);
          obs.next((current) => ({...current, a: `${current.a}-${initialState.a}`}));
          await sleep(1);
          obs.complete();
          watcher();
        }),
    });

    let called = 0;
    const confirmAWasChanged = vi.fn((s: typeof initialState) => {
      switch (called) {
        case 0:
          expect(s.a).toBe('a-a');
          break;
        case 1:
          expect(s.a).toBe('a-a-a');
          break;
        case 2:
          expect(s.a).toBe('a-a-a-a');
          break;
        default:
          throw new Error('test failure');
      }
      called = called + 1;
    });

    store.subscribe(confirmAWasChanged);

    // wait until complete called
    await new Promise((resolve) => {
      store.actions.handleAChangedStream(() => {
        resolve(null);
      });
    });
    expect(called).toBe(3);
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
