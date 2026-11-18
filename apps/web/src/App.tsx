import { lazy, Suspense } from 'react';
import { usePath } from './lib/router.ts';
import { Player } from './views/Player.tsx';

// The participant view ships in the main bundle; host, presenter and design pages load on demand.
const Present = lazy(() => import('./views/Present.tsx').then((m) => ({ default: m.Present })));
const HostHome = lazy(() => import('./views/HostHome.tsx').then((m) => ({ default: m.HostHome })));
const DesignSystem = lazy(() => import('./views/DesignSystem.tsx').then((m) => ({ default: m.DesignSystem })));

export function App() {
  const path = usePath();
  const live = path.match(/^\/live\/([\w-]{1,64})\/?$/);
  const join = path.match(/^\/join\/(\d{6})\/?$/);
  if (!live && path !== '/host' && path !== '/design') return <Player initialPin={join?.[1]} />;
  return (
    <Suspense fallback={null}>
      {live ? <Present sessionId={live[1]!} /> : path === '/host' ? <HostHome /> : <DesignSystem />}
    </Suspense>
  );
}
