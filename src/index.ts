import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector';

import {Subscribable, Middleware} from './subscribable';
import {shallowCompare} from './helpers';
import {Observable} from './observable';

export {Observable, Subscribable, Middleware};

type Updater<State> = (prev: State) => State;
type Setter<State> = Updater<State> | ((updater: Updater<State>) => void);

type BehaviorReturn<State> = ((s: State) => State) | ((s: State) => Promise<State>) | ((s: State) => Observable<(current: State) => State>);
type Behavior<State, Args extends ReadonlyArray<any>> = (...args: Args) => BehaviorReturn<State>;

export type Subscriber<State, Behaviors extends Record<string, Behavior<Readonly<State>, any>>> = {
  subscribe: (sub: (state: Readonly<State>) => void) => void;
  useSelector: <Selection>(selector: (s: Readonly<State>) => Selection, isEqual?: (a: Selection, b: Selection) => boolean) => Selection;
  getState(): Readonly<State>;
  setState: Setter<Readonly<State>>;
  actions: {[P in keyof Behaviors]: (...args: Parameters<Behaviors[P]>) => void};
};

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
        return (...args: ReadonlyArray<any>) => {
          const updater = method(...args);
          const nextState = updater(sub.getState());
          if (nextState instanceof Promise) {
            void nextState.then((s) => sub.update(s));
          } else if (nextState instanceof Observable) {
            const unsub = nextState.subscribe({
              next: (updater) => {
                sub.update(updater(sub.getState()));
              },
              // TODO: hmm... should handle error?
              // error: (err) => {????}
              complete: () => unsub(),
            });
          } else {
            sub.update(nextState);
          }
          return nextState;
        };
      },
    }),

    getState: sub.getState,
    setState,
  };
}
