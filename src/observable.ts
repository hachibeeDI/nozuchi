const UPDATE_EVENT_TYPE = 'update' as const;
const ERROR_EVENT_TYPE = 'error' as const;
const COMPLETE_EVENT_TYPE = 'complete' as const;

const CACHED_UPDATE_EVENT = new Event(UPDATE_EVENT_TYPE);
const CACHED_ERROR_EVENT = new Event(ERROR_EVENT_TYPE);
const CACHED_COMPLETE_EVENT = new Event(COMPLETE_EVENT_TYPE);

export class ObservableCompletedError extends Error {}

type Subscriber<V> = {
  next: (v: V) => void;
  error: (err: any) => void;
  complete: () => void;
};

/**
 * Small implementation of https://tc39.es/proposal-observable/
 */
export class Observable<V> {
  private readonly evt = new EventTarget();
  /**
   * TODO: should be array?
   */
  private stateCache: V | null = null;
  private errorCache: Error | null = null;
  private completed = false;

  private startObservation() {
    this.observe({
      next: (v: V) => {
        if (this.completed) {
          throw new ObservableCompletedError('This Observable has been completed.');
        }
        this.stateCache = v;
        this.evt.dispatchEvent(CACHED_UPDATE_EVENT);
      },

      error: (err: any) => {
        this.errorCache = err;
        this.evt.dispatchEvent(CACHED_ERROR_EVENT);
      },

      complete: () => {
        this.evt.dispatchEvent(CACHED_COMPLETE_EVENT);
      },
    });
  }

  /**
   * @param observe observe won't be called until [subscribe] called
   */
  public constructor(private readonly observe: (subscriber: Subscriber<V>) => void) {}

  public subscribe = (observer: {next: (v: V) => void; error?: (err: any) => void; complete?: () => void}) => {
    const innerUpdateSub = () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      observer.next(this.stateCache!);
    };
    this.evt.addEventListener(UPDATE_EVENT_TYPE, innerUpdateSub);

    const innerErrorSub = () => {
      if (observer.error) {
        observer.error(this.errorCache);
      }
    };
    this.evt.addEventListener(ERROR_EVENT_TYPE, innerErrorSub);

    const unsubscribe = () => {
      this.evt.removeEventListener(UPDATE_EVENT_TYPE, innerUpdateSub);

      if (observer.error) {
        this.evt.removeEventListener(ERROR_EVENT_TYPE, innerErrorSub);
      }
      if (observer.complete) {
        this.evt.removeEventListener(COMPLETE_EVENT_TYPE, observer.complete);
      }
      this.completed = true;
    };

    if (observer.complete) {
      this.evt.addEventListener(COMPLETE_EVENT_TYPE, observer.complete);
    }
    const innerCompletedSub = () => {
      unsubscribe();
    };
    this.evt.addEventListener(COMPLETE_EVENT_TYPE, innerCompletedSub);

    // lazy
    this.startObservation();

    return unsubscribe;
  };
}
