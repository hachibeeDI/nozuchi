[![Lint Check](https://github.com/hachibeeDI/nozuchi/actions/workflows/checker.yml/badge.svg)](https://github.com/hachibeeDI/nozuchi/actions/workflows/checker.yml)

# nozuchi

A minimal, type-safe React state management library built around **curried, pure-functional behaviors**.

```
npm install nozuchi
```

---

## Why nozuchi?

Most React state libraries ask you to mutate state or dispatch action objects. nozuchi takes a different approach: every state change is expressed as a **curried pure function**.

```ts
// A behavior: (args) => (prevState) => nextState
increment: () => (s) => ({...s, count: s.count + 1})
```

This one pattern scales to all three update modes — synchronous, async, and streaming — with no extra API to learn:

| Return type | Use case |
|---|---|
| `State` | Synchronous update |
| `Promise<State>` | Single async result (fetch, etc.) |
| `Observable<(State) => State>` | Stream of updates (WebSocket, SSE, etc.) |

Behaviors are plain functions. You can unit-test them without instantiating a store, mock nothing, and the types flow end-to-end without casting.

---

## Quick start

```ts
import {createStore, Observable} from 'nozuchi';

type State = {
  count: number;
  user: string | null;
  log: string[];
};

const store = createStore(
  {count: 0, user: null, log: []} satisfies State,
  {
    // Sync — returns next state directly
    increment: () => (s) => ({...s, count: s.count + 1}),

    // Async — returns a Promise
    loadUser: (id: string) => async (s) => {
      const res = await fetch(`/api/users/${id}`);
      const user = await res.json();
      return {...s, user: user.name};
    },

    // Streaming — returns an Observable for multiple updates over time
    streamLogs: (query: string) => (_s) =>
      new Observable((obs) => {
        const es = new EventSource(`/api/logs?q=${query}`);
        es.onmessage = (e) => obs.next((s) => ({...s, log: [...s.log, e.data]}));
        es.onerror   = () => obs.error(new Error('stream failed'));
        es.addEventListener('done', () => { obs.complete(); es.close(); });
      }),
  },
);
```

### In a React component

```tsx
function Counter() {
  // Re-renders only when count changes
  const count = store.useSelector((s) => s.count);

  return (
    <button onClick={() => store.actions.increment()}>
      clicked {count} times
    </button>
  );
}
```

### Outside React

```ts
// Raw subscription — useful for persistence, logging, analytics
const unsubscribe = store.subscribe((state) => {
  localStorage.setItem('state', JSON.stringify(state));
});

// Dispatch actions anywhere
store.actions.increment();
await store.actions.loadUser('42');
store.actions.streamLogs('error');
```

---

## Middleware

Intercept every state transition with `onInit` and `onUpdate` hooks:

```ts
const store = createStore(
  initialState,
  behaviors,
  {
    // Transform initial state (e.g. rehydrate from storage)
    onInit: (s) => ({...s, ...JSON.parse(localStorage.getItem('state') ?? '{}')}),

    // Intercept every update (e.g. logging, validation, time-travel)
    onUpdate: (next, prev) => {
      console.log('[store]', prev, '->', next);
      return next;
    },
  },
);
```

---

## Testing behaviors

Because behaviors are plain functions, they need no store to test:

```ts
import {increment, loadUser} from './store';

test('increment adds 1', () => {
  const result = increment()({count: 0, user: null, log: []});
  expect(result.count).toBe(1);
});
```

---

## RxJS interoperability

nozuchi's `Observable` implements the `Symbol.observable` protocol, so it works with `from()`, `merge()`, `concat()`, and any RxJS operator out of the box.
