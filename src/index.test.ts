import {test, expect, vi} from 'vitest';

import {createStore} from './index'; 

test('Store is subscribable', () => {
  const initialState = {a: 'a', b: 'b'};
  const store = createStore(initialState, {
    handleAChanged: (newA: string) => (s) => ({...s, a: newA}),
  });

  const confirmAWasChanged = vi.fn((s: typeof initialState) => {
    expect(s.a).toBe('newA');
  });

  store.subscribe(confirmAWasChanged);

  store.actions.handleAChanged('newA');

  expect(confirmAWasChanged).toBeCalledTimes(1);
});
