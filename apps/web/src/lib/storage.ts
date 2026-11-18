/** Storage that never throws (private mode, blocked site data). */
function safe(store: () => Storage) {
  return {
    get<T>(key: string): T | null {
      try {
        const v = store().getItem(key);
        return v ? (JSON.parse(v) as T) : null;
      } catch {
        return null;
      }
    },
    set(key: string, value: unknown) {
      try {
        store().setItem(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
    remove(key: string) {
      try {
        store().removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
export const local = safe(() => localStorage);
export const session = safe(() => sessionStorage);

export interface PlayerTicket {
  token: string;
  pin: string;
  nickname: string;
  at: number;
}
export const PLAYER_KEY = 'sq.player';
export const hostKey = (sessionId: string) => `sq.host.${sessionId}`;
