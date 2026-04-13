const UPDATE_EVENT = 'update';

/**
 * Lifecycle hooks that intercept state transitions in a {@link Subscribable}.
 * Pass as the third argument to {@link createStore} to apply cross-cutting
 * concerns such as logging, validation, or time-travel debugging.
 *
 * @example
 * const loggingMiddleware: Middleware<AppState> = {
 *   onInit: (s) => {
 *     console.log('[store] init', s);
 *     return s;
 *   },
 *   onUpdate: (next, prev) => {
 *     console.log('[store]', prev, '->', next);
 *     return next;
 *   },
 * };
 *
 * const store = createStore(initialState, behaviors, loggingMiddleware);
 */
export type Middleware<State> = {
  /**
   * Called once with the initial state before the store becomes active.
   * Return the (optionally transformed) initial state that the store should use.
   *
   * @example
   * // Rehydrate from localStorage on startup
   * onInit: (s) => ({...s, ...JSON.parse(localStorage.getItem('state') ?? '{}')}),
   */
  onInit?: (s: State) => State;

  /**
   * Called on every state transition. Return the value that should actually
   * be stored — return `next` unchanged if you only want to observe the change.
   *
   * @param newState - The proposed next state produced by the behavior.
   * @param prevState - The state before this transition.
   *
   * @example
   * // Clamp a numeric field so it never goes below zero
   * onUpdate: (next, _prev) => ({...next, count: Math.max(0, next.count)}),
   */
  onUpdate?: (newState: State, prevState: State) => State;
};

/**
 * Low-level reactive state container backed by the DOM `EventTarget` API.
 *
 * Used internally by {@link createStore}. Exposed for advanced use cases
 * such as building custom store wrappers or integrating with non-React
 * environments.
 *
 * Most users should interact with the store via the object returned by
 * {@link createStore} rather than using `Subscribable` directly.
 */
export class Subscribable<State> {
  private readonly evt = new EventTarget();

  private state: State;

  /**
   * Returns the current state synchronously.
   */
  public getState = (): State => {
    return this.state;
  };

  /**
   * @param initialState - The starting state.
   * @param eventHook - Optional {@link Middleware} applied to `onInit` and every `onUpdate`.
   */
  constructor(
    initialState: State,
    private readonly eventHook?: Middleware<State>,
  ) {
    this.state = eventHook?.onInit?.call(null, initialState) ?? initialState;
  }

  /**
   * Subscribes to every state change.
   *
   * @param sub - Callback invoked with the new state after each update.
   * @returns An unsubscribe function.
   */
  public subscribe = (sub: (state: State) => void): VoidFunction => {
    const innerSub = () => {
      sub(this.state);
    };
    this.evt.addEventListener('update', innerSub);
    return () => this.evt.removeEventListener('update', innerSub);
  };

  /**
   * Transitions the store to a new state, applies any `onUpdate` middleware,
   * and notifies all subscribers.
   *
   * @param newState - The next state value.
   * @returns The state that was actually stored (after middleware).
   */
  public update = (newState: State): State => {
    const newState_ = this.eventHook?.onUpdate?.call(null, newState, this.state) ?? newState;
    this.state = newState_;
    this.evt.dispatchEvent(new Event(UPDATE_EVENT));
    return this.state;
  };
}
