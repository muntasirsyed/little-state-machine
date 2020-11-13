import * as React from 'react';
import StoreFactory from './logic/storeFactory';
import { setUpDevTools } from './logic/devTool';
import {
  StoreUpdateFunction,
  StateMachineOptions,
  DeepPartial,
  ActionsArg,
  Actions,
} from './types';
import { STORE_ACTION_NAME, STORE_DEFAULT_NAME } from './constants';

const isClient = typeof window !== 'undefined';
const storeFactory = new StoreFactory(STORE_DEFAULT_NAME, isClient);

export const middleWare = <T extends unknown>(data: T): T => {
  if (data) {
    window[STORE_ACTION_NAME] = data;
  }

  return data;
};

export function createStore<T>(
  defaultStoreData: T,
  options: StateMachineOptions = {
    name: STORE_DEFAULT_NAME,
    middleWares: [],
  },
) {
  options.name && (storeFactory.name = options.name);
  options.storageType && (storeFactory.storageType = options.storageType);
  storeFactory.updateMiddleWares(options.middleWares);

  if (process.env.NODE_ENV !== 'production') {
    if (isClient) {
      window['__LSM_NAME__'] = storeFactory.name;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    setUpDevTools(
      storeFactory.storageType,
      storeFactory.name,
      storeFactory.store,
    );
  }

  storeFactory.updateStore(defaultStoreData);
}

const StateMachineContext = React.createContext({
  store: storeFactory.store,
  updateStore: (payload: unknown) => payload,
});

export function StateMachineProvider<T>(props: T) {
  const [globalState, updateStore] = React.useState(storeFactory.store);

  return (
    <StateMachineContext.Provider
      value={React.useMemo(
        () => ({
          store: globalState,
          updateStore,
        }),
        [globalState],
      )}
      {...props}
    />
  );
}

function actionTemplate<T>(
  updateStore: React.Dispatch<T>,
  callback: StoreUpdateFunction<T>,
) {
  return <K extends DeepPartial<T>>(payload: K) => {
    if (process.env.NODE_ENV !== 'production') {
      const debugName = callback ? callback.name : '';
      middleWare(debugName);
    }

    storeFactory.store = callback(storeFactory.store as T, payload);

    storeFactory.storageType.setItem(
      storeFactory.name,
      JSON.stringify(storeFactory.store),
    );

    if (storeFactory.middleWares.length) {
      storeFactory.store = storeFactory.middleWares.reduce(
        (currentValue, currentFunction) =>
          currentFunction(currentValue) || currentValue,
        storeFactory.store,
      );
    }

    updateStore(storeFactory.store as T);
  };
}

export function useStateMachine<
  T,
  TActions extends ActionsArg<T> = ActionsArg<T>
>(
  actions?: TActions,
): {
  actions: Actions<T, TActions>;
  state: T;
} {
  const { store, updateStore } = React.useContext(StateMachineContext);

  return React.useMemo(
    () => ({
      actions: actions
        ? Object.entries(actions).reduce(
            (previous, [key, callback]) => ({
              ...previous,
              [key]: actionTemplate<T>(updateStore, callback),
            }),
            {},
          )
        : ({} as any),
      state: store as T,
    }),
    [store, actions],
  );
}
