const UPDATE_EVENT = 'update';

export type Middleware<State> = {
  onInit?: (s: State) => State;
  onUpdate?: (newState: State, prevState: State) => State;
};

export class Subscribable<State> {
  private readonly evt = new EventTarget();

  private state: State;

  public getState = (): State => {
    return this.state;
  };

  constructor(
    initialState: State,
    private readonly eventHook?: Middleware<State>,
  ) {
    this.state = eventHook?.onInit?.call(null, initialState) ?? initialState;
  }

  /**
   * @param sub
   * @returns unsubscribe
   */
  public subscribe = (sub: (state: State) => void): VoidFunction => {
    const innerSub = () => {
      sub(this.state);
    };
    this.evt.addEventListener('update', innerSub);
    return () => this.evt.removeEventListener('update', innerSub);
  };

  public update = (newState: State): State => {
    const newState_ = this.eventHook?.onUpdate?.call(null, newState, this.state) ?? newState;
    this.state = newState_;
    this.evt.dispatchEvent(new Event(UPDATE_EVENT));
    return this.state;
  };
}
