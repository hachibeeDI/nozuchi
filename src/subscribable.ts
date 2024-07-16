const CACHED_UPDATE_EVENT = new Event('update');

export type FSA<Kind extends string, Payload> = {
  type: Kind;
  payload: Payload;
};

class ActionCreator<Kind extends string, Payload> {
  constructor(private readonly kind: Kind) {}

  public create(payload: Payload) {
    return {type: this.kind, payload};
  }

  public match<A extends FSA<string, any>>(a: A): boolean {
    return a.type === this.kind;
  }
}

export function createActionType<Payload, const Kind extends string = string>(kind: Kind): ActionCreator<Kind, Payload> {
  return new ActionCreator<Kind, Payload>(kind);
}

export const defaultActions = {
  initialized: createActionType('default/initialized'),
  updated: createActionType('default/updated'),
};

export type InferActions<AC extends ActionCreator<any, any>> = ReturnType<AC['create']>;

export type DefaultActions = InferActions<typeof defaultActions.initialized | typeof defaultActions.updated>;

export type Middleware<State, Action extends FSA<any, any> = DefaultActions> = {
  onInit?: (s: State) => State;
  onUpdate?: (newState: State, prevState: State) => State;
  onReceive?: (state: State, action: Action) => State | void | undefined;
};

export class Subscribable<State, Actions extends FSA<any, any>> {
  private readonly evt = new EventTarget();

  private state: State;

  public getState = () => {
    return this.state;
  };

  constructor(
    initialState: State,
    private readonly eventHook?: Middleware<State, Actions>,
  ) {
    this.state = eventHook?.onInit?.call(null, initialState) ?? initialState;
  }

  public subscribe = (sub: (state: State) => void) => {
    const innerSub = () => {
      sub(this.state);
    };
    this.evt.addEventListener('update', innerSub);
    return () => this.evt.removeEventListener('update', innerSub);
  };

  public update = (newState: State) => {
    const newState_ = this.eventHook?.onUpdate?.call(null, newState, this.state) ?? newState;
    this.state = newState_;
    this.evt.dispatchEvent(CACHED_UPDATE_EVENT);
    return this.state;
  };

  public receive = (action: Actions) => {
    const next = this.eventHook?.onReceive?.(this.state, action);
    if (next == null) {
      return;
    }
    return this.update(next);
  };
}
