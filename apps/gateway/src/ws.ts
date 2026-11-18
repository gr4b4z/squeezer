import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { ClientMessageSchema, type ErrorCode, type Role, type ServerMessage } from '@squeezer/shared';
import type { LiveSession } from './session.ts';
import type { SessionStore } from './store.ts';
import { RateLimiter } from './ratelimit.ts';

const MESSAGES: Record<ErrorCode, string> = {
  bad_message: 'Nieprawidłowa wiadomość.',
  not_found: 'Nie ma gry z tym PIN-em. Sprawdź go na ekranie.',
  unauthorized: 'Ten link do sesji jest nieważny.',
  nickname_taken: 'Ten nick jest zajęty. Dodaj cyfrę albo wybierz inny.',
  nickname_invalid: 'Nick musi mieć od 1 do 16 znaków.',
  session_full: 'Gra jest pełna.',
  late_join_closed: 'Gra już trwa i host nie przyjmuje nowych graczy.',
  session_ended: 'Ta gra już się skończyła.',
  not_open: 'Odpowiedzi są już zamknięte.',
  already_answered: 'Odpowiedź jest już zapisana.',
  rate_limited: 'Za dużo prób. Odczekaj minutę i spróbuj ponownie.',
  kicked: 'Host usunął cię z gry.',
};

export interface WsDeps {
  store: SessionStore;
  /** Failed PIN attempts per IP, shared with the HTTP PIN check. Successful joins do not count: a whole class can share one IP. */
  pinLimiter: RateLimiter;
}

interface Binding {
  session: LiveSession;
  role: Role;
  participantId?: string;
  unsubscribe: () => void;
}

export function registerWs(app: FastifyInstance, { store, pinLimiter }: WsDeps): void {
  app.get('/ws', { websocket: true }, (socket: WebSocket, req) => {
    const ip = req.ip;
    const msgLimiter = new RateLimiter(40, 1000);
    let bound: Binding | null = null;

    const send = (m: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(m));
    };
    const fail = (code: ErrorCode) => send({ t: 'error', code, message: MESSAGES[code] });

    const unbind = () => {
      if (!bound) return;
      bound.unsubscribe();
      if (bound.role === 'host') bound.session.hostConnected(-1);
      if (bound.participantId) bound.session.participantConnected(bound.participantId, -1);
      bound = null;
    };

    const bind = (session: LiveSession, role: Role, participantId?: string) => {
      unbind();
      const pushState = () => send({ t: 'state', state: session.view(role, participantId) });
      const unsubscribe = session.on((c) => {
        if (c === 'state') pushState();
        else send({ t: 'count', answered: session.answeredCount, players: session.playerCount, seq: session.seq });
      });
      bound = { session, role, unsubscribe, ...(participantId ? { participantId } : {}) };
      if (role === 'host') session.hostConnected(1);
      // participantConnected emits a state change when the player comes online, which pushes state;
      // push explicitly otherwise so a reconnect always gets the full current state.
      const before = session.seq;
      if (participantId) session.participantConnected(participantId, 1);
      if (session.seq === before) pushState();
    };

    socket.on('message', (data, isBinary) => {
      if (isBinary || (data as Buffer).length > 4096) return fail('bad_message');
      if (!msgLimiter.hit('m')) return fail('rate_limited');
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        return fail('bad_message');
      }
      const r = ClientMessageSchema.safeParse(parsed);
      if (!r.success) return fail('bad_message');
      const m = r.data;

      switch (m.t) {
        case 'ping':
          return send({ t: 'pong', at: m.at, serverNow: Date.now() });

        case 'hello': {
          const session = store.byId(m.sessionId);
          if (!session || !session.verify(m.role, m.token)) return fail('unauthorized');
          return bind(session, m.role);
        }

        case 'join': {
          if (pinLimiter.isBlocked(ip)) return fail('rate_limited');
          const session = store.byPin(m.pin);
          if (!session) {
            pinLimiter.hit(ip);
            return fail('not_found');
          }
          const res = store.join(session, m.nickname);
          if (!res.ok) return fail(res.code);
          send({ t: 'joined', token: res.token, participantId: res.participant.id, nickname: res.participant.nickname });
          return bind(session, 'participant', res.participant.id);
        }

        case 'resume': {
          const ref = store.resolveToken(m.token);
          if (!ref) return fail('not_found');
          const p = ref.session.getParticipant(ref.participantId)!;
          send({ t: 'joined', token: m.token, participantId: p.id, nickname: p.nickname });
          return bind(ref.session, 'participant', p.id);
        }

        case 'answer': {
          if (!bound?.participantId) return fail('unauthorized');
          const res = bound.session.answer(bound.participantId, m.slideId, m.option);
          if (!res.ok) return fail(res.code);
          return send({ t: 'answer_ack', slideId: m.slideId, option: m.option, latencyMs: res.latencyMs });
        }

        case 'host': {
          if (bound?.role !== 'host') return fail('unauthorized');
          bound.session.command(m.cmd);
          return;
        }
      }
    });

    socket.on('close', unbind);
    socket.on('error', unbind);
  });
}
