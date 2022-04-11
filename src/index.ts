import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/shim/with-selector';

function shallowCompareArray<T>(x: ReadonlyArray<T>, y: ReadonlyArray<T>) {
  if (x.length !== y.length) {
    return false;
  }
  return [...Array(x.length).keys()].every((i) => x[i] === y[i]);
}

// string or number of boolean
const primitiveHead = new RegExp('^[s|n|b]');

function isPrimitive(x: unknown) {
  return primitiveHead.test(typeof x);
}

function shallowCompare<T>(x: T, y: T) {
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
  const yKeys = Object.keys(y);
  const keyDiff = shallowCompareArray(xKeys, yKeys);
  if (keyDiff === false) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return xKeys.every((k) => (x as any)[k] === (y as any)[k]);
}

const CACHED_UPDATE_EVENT = new Event('update');

export class Subscribable<State> {
  private readonly evt = new EventTarget();

  private state: State;

  public getState = () => {
    return this.state;
  };

  constructor(initialState: State) {
    this.state = initialState;
  }

  public subscribe = (sub: (state: State) => void) => {
    const innerSub = () => {
      sub(this.state);
    };
    this.evt.addEventListener('update', innerSub);
    return () => this.evt.removeEventListener('update', innerSub);
  };

  public update = (newState: State) => {
    this.state = newState;
    this.evt.dispatchEvent(CACHED_UPDATE_EVENT);
    return this.state;
  };
}

type Updater<State> = (prev: State) => State;
type Setter<State> = Updater<State> | ((updater: Updater<State>) => void);

type BehaviorReturn<State> = (s: State) => State | ((s: State) => Promise<State>);
type Behavior<State, Args extends ReadonlyArray<any>> = (...args: Args) => BehaviorReturn<State>;

export type Subscriber<State, Behaviors extends Record<string, Behavior<State, any>>> = {
  subscribe: (sub: (state: State) => void) => () => void;
  useSelector: <Selection>(selector: (s: State) => Selection, isEqual?: (a: Selection, b: Selection) => boolean) => Selection;
  getState(): State;
  setState: Setter<State>;
  actions: {[P in keyof Behaviors]: (...args: Parameters<Behaviors[P]>) => void};
};

export function createStore<State, Behaviors extends Record<string, Behavior<State, any>>>(
  initialState: State,
  behaviors: Behaviors,
): Subscriber<State, Behaviors> {
  const sub = new Subscribable(initialState);

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
        const method: (...a: ReadonlyArray<any>) => any = target[name as string] as any;
        return (...args: ReadonlyArray<any>) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const updater: (s: State) => State = method(...args);
          const nextState = updater(sub.getState());
          sub.update(nextState);
          return nextState;
        };
      },
    }),

    getState: sub.getState,
    setState,
  };
}
