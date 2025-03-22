[![Lint Check](https://github.com/hachibeeDI/nozuchi/actions/workflows/checker.yml/badge.svg)](https://github.com/hachibeeDI/nozuchi/actions/workflows/checker.yml)

# Nozuchi

A simple state management tool.

Features:

- typesafe
- functional
- supports Promise
- supports Observable

## Example

### Sync example

```typescript
const initialState = {count: 0, b: 'b'};
const store = createStore(initialState, {
  // (arg: T) => (previousStore: S) => S;
  handleAClicked: () => (prev) => ({...prev, count: prev.count + 1}),
});

// supports React hooks integration
const [c] = store.useSelector((s) => [s.count]);
return (
  <div>
    <button
      // call your methods via `actions`
      onClick={store.actions.handleAClicked}
    >clicked {c} times</button>
  </div>
);
```

### Promise sample

```typescript
const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time)); //timeはミリ秒

const store = createStore(initialState, {
  handleAChangedAsync: (newA: string) => async (prev) => {
    await sleep(1);
    return {...prev, a: newA};
  },
});
```

### Observable sample

```typescript
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
```
