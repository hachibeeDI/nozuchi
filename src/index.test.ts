import {describe, test, expect, vi, assertType} from 'vitest';

import {createStore} from './index';
import {shallowCompare, isPrimitive} from './helpers';
import {Observable, symbolObservable} from './observable';

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

    const result = store.actions.handleAChanged('newA');
    assertType<typeof initialState>(result);
    expect(result).toStrictEqual({a: 'newA', b: 'b'});

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

      const result = store.actions.handleAChangedAsync('newA async');
      assertType<Promise<typeof initialState>>(result);
    });
  });

  test('can handle multiple return type of behavior', async () => {
    const initialState = {forNormal: 'n/a', forPromise: 'n/a', forObservable: 'n/a'};
    const store = createStore(initialState, {
      handleFlexible: (type: 'normal' | 'promise' | 'observable', value: string) => (prev) => {
        switch (type) {
          case 'normal':
            return {...prev, forNormal: value};
          case 'promise':
            return sleep(1).then(() => ({...prev, forPromise: value}));
          case 'observable':
            return new Observable((obs) => setTimeout(() => obs.next((p) => ({...p, forObservable: value})), 1));
        }
      },
    });

    store.actions.handleFlexible('normal', 'change1');
    expect(store.getState().forNormal).toEqual('change1');

    await store.actions.handleFlexible('promise', 'change2');
    expect(store.getState().forPromise).toEqual('change2');

    await new Promise<void>((done) => {
      const obs = store.actions.handleFlexible('observable', 'change3') as any as Observable<typeof initialState>;
      obs.subscribe({next: () => done()});
    });
    expect(store.getState().forObservable).toEqual('change3');
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

describe('isPrimitive', () => {
  test('returns true for all JS primitive types', () => {
    expect(isPrimitive('hello')).toBe(true);
    expect(isPrimitive(42)).toBe(true);
    expect(isPrimitive(true)).toBe(true);
    expect(isPrimitive(undefined)).toBe(true);
    expect(isPrimitive(Symbol('s'))).toBe(true);
    expect(isPrimitive(42n)).toBe(true);
  });

  test('returns false for non-primitive types', () => {
    expect(isPrimitive(null)).toBe(false);
    expect(isPrimitive({})).toBe(false);
    expect(isPrimitive([])).toBe(false);
    expect(isPrimitive(() => {})).toBe(false);
  });
});

describe('Observable', () => {
  test('implements Symbol.observable — returns itself for interoperability', () => {
    const obs = new Observable<number>((sub) => {
      sub.next(1);
    });

    const interop = obs as unknown as Record<symbol, () => typeof obs>;
    expect(interop[symbolObservable]()).toBe(obs);
  });

  test('producer runs only once even with multiple subscribers', async () => {
    let producerCallCount = 0;
    const obs = new Observable<number>(async (sub) => {
      producerCallCount++;
      await sleep(1);
      sub.next(1);
      await sleep(1);
      sub.next(2);
      sub.complete();
    });

    const received1: number[] = [];
    const received2: number[] = [];

    obs.subscribe({next: (v) => received1.push(v)});
    obs.subscribe({next: (v) => received2.push(v)});

    await sleep(20);

    expect(producerCallCount).toBe(1);
    expect(received1).toEqual([1, 2]);
    expect(received2).toEqual([1, 2]);
  });

  test('unsubscribing one subscriber does not affect others', async () => {
    const obs = new Observable<number>(async (sub) => {
      await sleep(5);
      sub.next(1);
      await sleep(20);
      sub.next(2);
    });

    const received1: number[] = [];
    const received2: number[] = [];

    const unsub1 = obs.subscribe({next: (v) => received1.push(v)});
    obs.subscribe({next: (v) => received2.push(v)});

    await sleep(10); // after first emission (5ms), before second (25ms)
    unsub1();
    await sleep(25); // wait for second emission

    expect(received1).toEqual([1]);
    expect(received2).toEqual([1, 2]);
  });

  test('next after complete is silently ignored, not thrown', () => {
    let caughtError: unknown;
    const obs = new Observable<number>((sub) => {
      sub.next(1);
      sub.complete();
      try {
        sub.next(2);
      } catch (e) {
        caughtError = e;
      }
    });

    const received: number[] = [];
    obs.subscribe({next: (v) => received.push(v)});

    expect(caughtError).toBeUndefined();
    expect(received).toEqual([1]);
  });

  test('complete callback fires exactly once', async () => {
    const obs = new Observable<number>(async (sub) => {
      await sleep(1);
      sub.next(1);
      sub.complete();
    });

    const onComplete = vi.fn();
    obs.subscribe({next: () => {}, complete: onComplete});
    obs.subscribe({next: () => {}, complete: onComplete});

    await sleep(10);

    expect(onComplete).toBeCalledTimes(2);
  });

  test('Observable error in store action is not silently swallowed', async () => {
    const initialState = {value: 'initial'};
    const store = createStore(initialState, {
      doFetch: () => (_prev) =>
        new Observable<(s: typeof initialState) => typeof initialState>((sub) => {
          setTimeout(() => sub.error(new Error('network error')), 1);
        }),
    });

    const errorReceived = await new Promise<Error | null>((resolve) => {
      process.on('uncaughtException', (err) => resolve(err));
      store.actions.doFetch();
      setTimeout(() => resolve(null), 20);
    });

    expect(errorReceived).toBeInstanceOf(Error);
    expect((errorReceived as Error).message).toBe('network error');
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
