const UPDATE_EVENT_TYPE = 'update' as const;
const ERROR_EVENT_TYPE = 'error' as const;
const COMPLETE_EVENT_TYPE = 'complete' as const;

/**
 * The resolved Symbol.observable value, with a fallback for environments that don't support it.
 * Exported so users can reference it directly (e.g. for their own type augmentation).
 *
 * To enable TypeScript type checking on the interop protocol, add this to your project:
 * @example
 * declare global {
 *   interface SymbolConstructor { readonly observable: symbol; }
 * }
 */
export const symbolObservable: symbol = (Symbol as {observable?: symbol}).observable ?? Symbol('observable');

export class ObservableCompletedError extends Error {}

type Subscriber<V> = {
  next: (v: V) => void;
  error: (err: unknown) => void;
  complete: () => void;
};

/**
 * Small implementation of https://tc39.es/proposal-observable/
 */
export class Observable<V> {
  private readonly evt = new EventTarget();
  private stateCache: V | null = null;
  private errorCache: unknown = null;
  private completed = false;
  private started = false;

  private startObservation(): void {
    this.observe({
      next: (v: V) => {
        if (this.completed) {
          return;
        }
        this.stateCache = v;
        this.evt.dispatchEvent(new Event(UPDATE_EVENT_TYPE));
      },

      error: (err: unknown) => {
        this.errorCache = err;
        this.evt.dispatchEvent(new Event(ERROR_EVENT_TYPE));
      },

      complete: () => {
        this.completed = true;
        this.evt.dispatchEvent(new Event(COMPLETE_EVENT_TYPE));
      },
    });
  }

  /**
   * @param observe observe won't be called until [subscribe] called
   */
  public constructor(private readonly observe: (subscriber: Subscriber<V>) => void) {}

  /**
   * @returns unsubscribe
   */
  public subscribe = (observer: {next: (v: V) => void; error?: (err: unknown) => void; complete?: () => void}): VoidFunction => {
    const innerUpdateSub = () => {
      observer.next(this.stateCache!);
    };
    this.evt.addEventListener(UPDATE_EVENT_TYPE, innerUpdateSub);

    const innerErrorSub = () => {
      observer.error?.(this.errorCache);
    };
    this.evt.addEventListener(ERROR_EVENT_TYPE, innerErrorSub);

    const innerCompleteSub = () => {
      unsubscribe();
      observer.complete?.();
    };
    this.evt.addEventListener(COMPLETE_EVENT_TYPE, innerCompleteSub);

    const unsubscribe = () => {
      this.evt.removeEventListener(UPDATE_EVENT_TYPE, innerUpdateSub);
      this.evt.removeEventListener(ERROR_EVENT_TYPE, innerErrorSub);
      this.evt.removeEventListener(COMPLETE_EVENT_TYPE, innerCompleteSub);
    };

    if (!this.started) {
      this.started = true;
      this.startObservation();
    }

    return unsubscribe;
  };
}

/**
 * Implements the Observable interop protocol (Symbol.observable).
 * Using Object.defineProperty because TypeScript's computed property syntax
 * requires a unique symbol, but symbolObservable is typed as symbol.
 */
Object.defineProperty(Observable.prototype, symbolObservable, {
  value<V>(this: Observable<V>): Observable<V> {
    return this;
  },
  writable: true,
  configurable: true,
});
