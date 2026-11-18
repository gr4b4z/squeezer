import { useSyncExternalStore } from 'react';

const subscribe = (fn: () => void) => {
  addEventListener('popstate', fn);
  return () => removeEventListener('popstate', fn);
};

export function navigate(path: string) {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}
