/** Polish UI strings. English is added in the hardening step; keep every user-facing string here. */
export const pl = {
  tagline: 'Wyciśnij z sali, co wie.',
  join: {
    title: 'Dołącz do gry',
    pinHint: 'Wpisz PIN z ekranu prezentera.',
    pinLabel: 'PIN gry',
    pinShort: 'PIN ma 6 cyfr. Sprawdź go na ekranie.',
    pinUnknown: 'Nie ma gry z tym PIN-em. Sprawdź go na ekranie.',
    next: 'Dalej',
    nickTitle: 'Jak cię nazwać?',
    nickHint: 'Tę nazwę zobaczy cała sala.',
    nickLabel: 'Nick',
    nickEmpty: 'Wpisz nick, żeby dołączyć.',
    enter: 'Wchodzę',
    changePin: 'Zmień PIN',
  },
  play: {
    youreIn: 'Jesteś w grze',
    watchScreen: 'Patrz na ekran',
    waitingStart: (n: number) => `Czekamy na start · ${players(n)}`,
    question: (i: number, n: number) => `Pytanie ${i}/${n}`,
    saved: 'Odpowiedź zapisana',
    answeredOf: (a: number, n: number) => `${a} z ${n} już odpowiedziało`,
    closed: 'Odpowiedzi są już zamknięte',
    right: 'Dobrze!',
    wrong: 'Tym razem nie',
    none: 'Brak odpowiedzi',
    correctWas: 'Poprawna odpowiedź',
    streak: (n: number) => `Seria: ${n} z rzędu`,
    total: (p: string) => `Razem: ${p} pkt`,
    yourPlace: 'Twoje miejsce',
    finalResult: 'Wynik końcowy',
    of: (n: number) => `z ${players(n)}`,
    gap: (rank: number, pts: string) => `Do miejsca #${rank} brakuje ${pts} pkt`,
    leading: 'Prowadzisz. Utrzymaj to!',
    correctCount: (c: number, n: number) => `${c} z ${n} poprawnych`,
    thanks: 'Dzięki za grę. Możesz zamknąć tę kartę.',
    reconnecting: 'Łączymy ponownie…',
    lookAtScreen: 'Slajd jest na ekranie',
  },
  stage: {
    joinAt: 'Wejdź na',
    andPin: 'i wpisz PIN',
    orScan: 'albo zeskanuj kod aparatem telefonu',
    inLobby: (n: number) => `${playersWord(n)} w lobby`,
    waitHost: 'Gra zacznie się, gdy host naciśnie Start',
    question: (i: number, n: number) => `Pytanie ${i} z ${n}`,
    answers: (a: number, n: number) => `${a} / ${n} odpowiedzi`,
    pctCorrect: (p: number) => `${p}% poprawnych`,
    ranking: 'Ranking',
    after: (i: number, n: number) => `Po pytaniu ${i} z ${n}`,
    end: (n: number) => `Koniec gry · ${players(n)}`,
    thanks: 'Dzięki za grę!',
  },
  host: {
    pickDeck: 'Wybierz quiz',
    pickHint: 'Gra startuje w lobby. Uczestnicy dołączają PIN-em z ekranu.',
    settings: 'Ustawienia sesji',
    showLeaderboard: 'Ranking między pytaniami',
    speedScoring: 'Więcej punktów za szybkość',
    lateJoin: 'Dołączanie po starcie',
    start: 'Otwórz lobby',
    slides: (s: number, q: number) => `${s} slajdów · ${q} pytań`,
    controls: 'Host',
    next: {
      lobby: 'Start',
      slide: 'Dalej',
      question: 'Zamknij odpowiedzi',
      reveal: 'Dalej',
      leaderboard: 'Następne pytanie',
      ended: 'Koniec',
    },
    end: 'Zakończ grę',
    endConfirm: 'Zakończyć grę dla wszystkich?',
    endYes: 'Tak, zakończ',
    cancel: 'Anuluj',
    fullscreen: 'Pełny ekran',
    copyLink: 'Kopiuj link do ekranu',
    copied: 'Skopiowano',
    keys: 'Spacja: dalej · C: zamknij · F: pełny ekran · H: ukryj pasek',
    noAccess: 'Ten link do sesji jest nieważny albo sesja wygasła.',
    newSession: 'Nowa sesja',
  },
} as const;

/** Polish plural of "gracz": 1 gracz, 2–4 gracze, 5+ graczy, 22–24 gracze. */
export function playersWord(n: number): string {
  if (n === 1) return 'gracz';
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'gracze' : 'graczy';
}
const players = (n: number) => `${n} ${playersWord(n)}`;

export const t = pl;
export const fmt = (n: number) => n.toLocaleString('pl-PL');
