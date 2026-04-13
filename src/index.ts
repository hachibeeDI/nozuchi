import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector';

import {Subscribable, Middleware} from './subscribable';
import {shallowCompare} from './helpers';
import {Observable} from './observable';

export {Observable, Subscribable, Middleware};

type Updater<State> = (prev: State) => State;
type Setter<State> = Updater<State> | ((updater: Updater<State>) => void);

type BehaviorReturn<State> = (s: State) => State | Promise<State> | Observable<(current: State) => State>;
type Behavior<State, Args extends ReadonlyArray<any>> = (...args: Args) => BehaviorReturn<State>;

/**
 * The store object returned by {@link createStore}.
 * Provides a React hook, raw subscriptions, and fully-typed action dispatchers.
 */
export type Subscriber<State, Behaviors extends Record<string, Behavior<Readonly<State>, any>>> = {
  /**
   * Subscribes to every state change outside of React.
   * Useful for side effects such as logging, persistence, or analytics.
   *
   * @param sub - Called with the new state after each update.
   * @returns An unsubscribe function. Call it to stop listening.
   *
   * @example
   * const unsubscribe = store.subscribe((state) => {
   *   localStorage.setItem('appState', JSON.stringify(state));
   * });
   * // later:
   * unsubscribe();
   */
  subscribe: (sub: (state: Readonly<State>) => void) => void;

  /**
   * React hook that subscribes to a derived slice of store state.
   * Re-renders only when the selected value changes according to `isEqual`.
   * Defaults to shallow comparison, so returning plain objects or arrays
   * from the selector does not cause unnecessary re-renders.
   *
   * @param selector - Derives the value of interest from the full state.
   * @param isEqual - Custom equality function. Defaults to {@link shallowCompare}.
   *
   * @example
   * function UserCard() {
   *   const name = userStore.useSelector((s) => s.user.name);
   *   return <span>{name}</span>;
   * }
   *
   * @example
   * // Custom equality — only re-render when the id actually changes
   * const id = store.useSelector((s) => s.user.id, (a, b) => a === b);
   */
  useSelector: <Selection>(selector: (s: Readonly<State>) => Selection, isEqual?: (a: Selection, b: Selection) => boolean) => Selection;

  /**
   * Returns the current state synchronously.
   * Prefer {@link useSelector} inside React components.
   */
  getState(): Readonly<State>;

  /**
   * Directly sets the store state, bypassing behaviors.
   * Accepts either a replacement value or an updater function `(prev) => next`.
   *
   * Prefer defining a behavior when possible — behaviors are pure functions
   * that are easy to test in isolation and make state transitions explicit.
   *
   * @example
   * store.setState({count: 0});                        // replace
   * store.setState((prev) => ({...prev, count: 0}));   // update
   */
  setState: Setter<Readonly<State>>;

  /**
   * Dispatches a behavior to update the store state.
   * The store transparently handles behaviors that return a plain state,
   * a `Promise`, or an `Observable`.
   *
   * @example
   * store.actions.increment();              // sync
   * await store.actions.fetchUser('42');    // async
   * store.actions.streamLogs('query');      // Observable streaming
   */
  actions: {[P in keyof Behaviors]: (...args: Parameters<Behaviors[P]>) => ReturnType<ReturnType<Behaviors[P]>>};
};

/**
 * Creates a type-safe reactive store for React.
 *
 * Each behavior is a curried pure function of the form
 * `(args) => (prevState) => nextState`.
 * Behaviors can return a plain state value, a `Promise`, or an `Observable`
 * for streaming updates — the store handles all three automatically.
 *
 * @param initialState - The initial state of the store.
 * @param behaviors - An object of state-transition functions. Each key is an
 *   action name; each value receives call arguments and returns a function from
 *   the previous state to the next state (or a `Promise`/`Observable` thereof).
 * @param middleware - Optional lifecycle hooks applied to every state transition.
 *   See {@link Middleware}.
 * @returns A {@link Subscriber} with `actions`, `useSelector`, `subscribe`,
 *   `getState`, and `setState`.
 *
 * @example
 * // Synchronous behaviors
 * const counterStore = createStore(
 *   {count: 0},
 *   {
 *     increment: () => (s) => ({...s, count: s.count + 1}),
 *     decrement: () => (s) => ({...s, count: s.count - 1}),
 *     setCount:  (n: number) => (_s) => ({count: n}),
 *   },
 * );
 *
 * counterStore.actions.increment(); // state becomes {count: 1}
 *
 * function Counter() {
 *   const count = counterStore.useSelector((s) => s.count);
 *   return <button onClick={() => counterStore.actions.increment()}>{count}</button>;
 * }
 *
 * @example
 * // Async behavior (Promise)
 * const userStore = createStore(
 *   {user: null as User | null},
 *   {
 *     fetchUser: (id: string) => async (s) => {
 *       const user = await api.getUser(id);
 *       return {...s, user};
 *     },
 *   },
 * );
 *
 * await userStore.actions.fetchUser('42');
 *
 * @example
 * // Streaming behavior (Observable) — e.g. WebSocket or chunked HTTP
 * const chatStore = createStore(
 *   {messages: [] as string[]},
 *   {
 *     streamRoom: (roomId: string) => (_s) =>
 *       new Observable((obs) => {
 *         const ws = new WebSocket(`wss://example.com/rooms/${roomId}`);
 *         ws.onmessage = (e) => obs.next((s) => ({...s, messages: [...s.messages, e.data]}));
 *         ws.onerror  = () => obs.error(new Error('connection lost'));
 *         ws.onclose  = () => obs.complete();
 *       }),
 *   },
 * );
 *
 * @example
 * // Middleware — logging every transition
 * const store = createStore(
 *   initialState,
 *   behaviors,
 *   {
 *     onInit:   (s) => { console.log('init', s); return s; },
 *     onUpdate: (next, prev) => { console.log(prev, '->', next); return next; },
 *   },
 * );
 */
export function createStore<State, Behaviors extends Record<string, Behavior<State, any>>>(
  initialState: State,
  behaviors: Behaviors,
  middleware?: Middleware<State>,
): Subscriber<State, Behaviors> {
  const sub = new Subscribable(initialState, middleware);

  const setState: Setter<State> = (sOrUpdate: State | Updater<State>) => {
    if (typeof sOrUpdate === 'function') {
      const prev = sub.getState();
      const nextState = (sOrUpdate as Updater<State>)(prev);
      return sub.update(nextState);
    }
    return sub.update(sOrUpdate);
  };

  return {
    subscribe: sub.subscribe,
    useSelector: <Selection>(selector: (s: State) => Selection, isEqual: (a: Selection, b: Selection) => boolean = shallowCompare) => {
      return useSyncExternalStoreWithSelector(sub.subscribe, sub.getState, sub.getState, selector, isEqual);
    },
    actions: new Proxy(behaviors, {
      /**
       * behaviorで定義した (a: Args) => (s: State) => State
       * の処理をインタラプトしてstateの更新を挟む
       */
      get(target, name) {
        if (name in target === false) {
          throw new TypeError(`method ${name.toString()} is not defined in store`);
        }
        const method: (...a: ReadonlyArray<any>) => BehaviorReturn<State> = target[name as string] as any;
        return (...args: ReadonlyArray<any>): ReturnType<BehaviorReturn<State>> => {
          const updater = method(...args);
          const nextState = updater(sub.getState());
          if (nextState instanceof Promise) {
            return nextState.then((s) => sub.update(s));
          } else if (nextState instanceof Observable) {
            const unsub = nextState.subscribe({
              next: (updater) => {
                sub.update(updater(sub.getState()));
              },
              error: (err) => {
                throw err instanceof Error ? err : new Error(String(err));
              },
              complete: () => unsub(),
            });
            return nextState;
          } else {
            return sub.update(nextState);
          }
        };
      },
    }) as any, // it's hard to apply decent typing for Proxy...

    getState: sub.getState,
    setState,
  };
}
