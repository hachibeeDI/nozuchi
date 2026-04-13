const UPDATE_EVENT_TYPE = 'update' as const;
const ERROR_EVENT_TYPE = 'error' as const;
const COMPLETE_EVENT_TYPE = 'complete' as const;

/**
 * The resolved `Symbol.observable` value, with a fallback for environments
 * that do not yet expose it on `Symbol`.
 *
 * Exported so consumers can reference it directly — for example when
 * integrating with libraries that read `Symbol.observable` at runtime,
 * or when writing their own TypeScript type augmentations.
 *
 * If you want TypeScript to type-check `obj[Symbol.observable]()` calls
 * in your project, add the following declaration once (e.g. in a `.d.ts` file):
 *
 * @example
 * declare global {
 *   interface SymbolConstructor { readonly observable: symbol; }
 * }
 */
export const symbolObservable: symbol = (Symbol as {observable?: symbol}).observable ?? Symbol('observable');

/**
 * Thrown when the Observable producer emits `next` after `complete`
 * has already been signalled. Not normally encountered by library consumers.
 */
export class ObservableCompletedError extends Error {}

type Subscriber<V> = {
  next: (v: V) => void;
  error: (err: unknown) => void;
  complete: () => void;
};

/**
 * A lightweight multicast Observable based on the
 * {@link https://tc39.es/proposal-observable/ TC39 Observable proposal}.
 *
 * **Lazy & multicast**: the producer function runs only when the first
 * subscriber attaches. All subsequent subscribers share that single producer
 * via an internal `EventTarget` bus.
 *
 * Use `Observable` as a behavior return type when a single user action needs
 * to push multiple state updates over time — streaming API responses,
 * WebSocket messages, animation frames, etc.
 *
 * @example
 * // Inside a createStore behavior — stream server-sent events into state
 * const store = createStore(
 *   {lines: [] as string[]},
 *   {
 *     streamLogs: (query: string) => (_s) =>
 *       new Observable<(s: {lines: string[]}) => {lines: string[]}>((obs) => {
 *         const es = new EventSource(`/logs?q=${query}`);
 *         es.onmessage = (e) => obs.next((s) => ({...s, lines: [...s.lines, e.data]}));
 *         es.onerror   = () => obs.error(new Error('stream failed'));
 *         es.addEventListener('done', () => { obs.complete(); es.close(); });
 *       }),
 *   },
 * );
 *
 * store.actions.streamLogs('error');
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
   * @param observe The producer function. Receives a subscriber object with
   *   three callbacks. Executed lazily — called only when the first observer
   *   subscribes.
   *   - `next(value)` — push the next value to all subscribers.
   *     No-op after `complete()` has been called.
   *   - `error(err)` — signal a terminal error. Delivers the error to all
   *     subscribers and stops further emissions.
   *   - `complete()` — signal that the stream has ended normally. Subsequent
   *     `next` calls are silently ignored.
   */
  public constructor(private readonly observe: (subscriber: Subscriber<V>) => void) {}

  /**
   * Attaches an observer to the Observable.
   * The producer starts on the first call; subsequent calls share the same
   * running producer (multicast).
   *
   * @param observer.next - Receives each emitted value.
   * @param observer.error - Called if the producer signals failure (optional).
   * @param observer.complete - Called once when the producer signals the end of
   *   the stream (optional).
   * @returns An unsubscribe function. Calling it detaches only this observer;
   *   other observers are unaffected and the producer keeps running.
   *
   * @example
   * const obs = new Observable<number>((sub) => {
   *   let i = 0;
   *   const id = setInterval(() => {
   *     if (i >= 3) { sub.complete(); clearInterval(id); return; }
   *     sub.next(i++);
   *   }, 100);
   * });
   *
   * const unsubscribe = obs.subscribe({
   *   next:     (v) => console.log('value', v),
   *   error:    (e) => console.error('error', e),
   *   complete: ()  => console.log('done'),
   * });
   *
   * // Stop early if needed:
   * // unsubscribe();
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
 * Implements the Observable interop protocol (`Symbol.observable`).
 * Enables this Observable to be consumed by RxJS and any library that
 * checks `Symbol.observable` for duck-typing.
 *
 * Uses `Object.defineProperty` because TypeScript's computed property syntax
 * in class bodies requires a `unique symbol`, but {@link symbolObservable}
 * is typed as `symbol`.
 */
Object.defineProperty(Observable.prototype, symbolObservable, {
  value<V>(this: Observable<V>): Observable<V> {
    return this;
  },
  writable: true,
  configurable: true,
});
