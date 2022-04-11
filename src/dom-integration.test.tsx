import React from 'react';

import {test, expect} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';

import {createStore} from './index'; 

const initialState = {count: 0, b: 'b'};
const store = createStore(initialState, {
  handleAClicked: () => (prev) => ({...prev, count: prev.count + 1}),
});

test('Selector was memoized', () => {
  let aCalled = 0;
  const ARefComponent = () => {
    const selectedCount = store.useSelector(s => s.count);
    aCalled = aCalled + 1;
    return <div data-testid="a">count = {selectedCount}</div>;
  };
  let bCalled = 0;
  const BRefComponent = () => {
    const selectedA = store.useSelector(s => s.b);
    bCalled = bCalled + 1;
    return <div>{selectedA}</div>;
  };
  const Top = () => {
    return (
      <div>
        <ARefComponent />
        <BRefComponent />
        <button onClick={() => store.actions.handleAClicked()} />
      </div>
    )
  }

  render(<Top />);

  fireEvent.click(screen.getByRole('button'));
  
  expect(aCalled).toBe(2);
  expect(bCalled).toBe(1);

  expect(screen.getByTestId('a').textContent)
    .toBe('count = 1');

  fireEvent.click(screen.getByRole('button'));
  
  expect(aCalled).toBe(3);
  expect(bCalled).toBe(1);

  expect(screen.getByTestId('a').textContent)
    .toBe('count = 2');
});
