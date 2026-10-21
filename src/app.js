/**
 * The application controller.
 *
 * Owns the session lifecycle — creating a room, joining one, leaving — and
 * routes between the screens. The screens themselves are renderers that
 * receive state and callbacks.
 *
 * The URL is the only navigation mechanism:
 *
 * - `/` → the home screen
 * - `/?room=K7P4` → join the room with that code
 *
 * There are no history entries to manage and no router to get wrong, which
 * keeps a static deploy simple.
 */

import { DEFAULT_RULES, ICE_SERVERS } from './config.js';
import Peer from 'peerjs';
import { parseRoomCode } from './core/room-code.js';
import { createRandomRng } from './core/rng.js';
import { generateSecret } from './core/secret.js';
import { Phase } from './core/state.js';
import { HostSession } from './net/host-session.js';
import { GuestSession } from './net/guest-session.js';
import { LinkFailure, LinkState } from './net/peer-link.js';
import { el, clear } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { t } from './i18n/index.js';
import { showBanner, hideBanner, showToast } from './ui/components/notices.js';
import { createLanguageToggle } from './ui/components/language-toggle.js';
import { createHomeScreen } from './ui/screens/home.js';
import { createJoinScreen } from './ui/screens/join.js';
import { createRoomScreen } from './ui/screens/room.js';
import { createGameScreen } from './ui/screens/game.js';
import { createResultScreen } from './ui/screens/result.js';
import { playSfx, unlockAudio, vibrate } from './ui/sfx.js';

/**
 * Creates a real PeerJS peer.
 *
 * The factory is injected into the session so the transport can be tested
 * without a browser or a network.
 *
 * It is deliberately **synchronous**: the transport attaches its handlers the
 * moment it receives the peer, and an async factory would hand it a promise
 * instead. PeerJS is imported statically, and the bundler keeps it in its own
 * chunk.
 *
 * @param {string | undefined} id
 * @param {Record<string, unknown>} options
 * @returns {import('./net/peer-link.js').PeerLike}
 */
function createPeer(id, options) {
  return /** @type {any} */ (
    new Peer(/** @type {string} */ (id), {
      debug: 0,
      config: { iceServers: ICE_SERVERS },
      ...options,
    })
  );
}

/**
 * The room code in the current URL, if there is a valid one.
 *
 * @returns {string | null}
 */
export function roomCodeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return parseRoomCode(params.get('room'));
}

/**
 * The application.
 */
export class App {
  /** @type {HostSession | GuestSession | null} */
  #session = null;

  /** @type {string | null} */
  #code = null;

  /** @type {import('./core/state.js').GameState | null} */
  #state = null;

  /** @type {ReturnType<typeof createHomeScreen> | null} */
  #home = null;

  /** @type {ReturnType<typeof createRoomScreen> | null} */
  #room = null;

  /** @type {ReturnType<typeof createGameScreen> | null} */
  #game = null;

  /** @type {string} */
  #playerName = 'Player';

  /** @type {number} */
  #playerAvatar = 0;

  /** @type {string} */
  #locale = 'en';

  /** Whether the player has already chosen a name on this device. */
  #hasName = false;

  /** @type {'home' | 'join' | 'room' | 'game' | 'result' | 'ended'} */
  #screen = 'home';

  /** @type {ReturnType<typeof setInterval> | null} */
  #countdownTimer = null;

  /**
   * @param {object} options
   * @param {HTMLElement} options.screenRoot
   * @param {HTMLElement} options.roomBar
   * @param {HTMLElement} options.bannerRoot
   * @param {HTMLElement} options.toastRoot
   * @param {string} options.playerName
   * @param {number} options.playerAvatar
   * @param {string} options.locale
   * @param {boolean} [options.hasName]  Whether the player has chosen a name before.
   */
  constructor(options) {
    this.options = options;
    this.#playerName = options.playerName;
    this.#playerAvatar = options.playerAvatar;
    this.#locale = options.locale;
    this.#hasName = options.hasName ?? false;
  }

  /**
   * Records the player's chosen name.
   *
   * @param {string} name
   * @param {number} [avatarIndex]
   */
  setPlayerName(name, avatarIndex) {
    this.#playerName = name;
    this.#hasName = true;
    if (typeof avatarIndex === 'number') {
      this.#playerAvatar = avatarIndex;
    }
  }

  /**
   * The current room code, if there is one.
   *
   * @returns {string | null}
   */
  get code() {
    return this.#code;
  }

  /**
   * The current session, if there is one.
   *
   * @returns {HostSession | GuestSession | null}
   */
  get session() {
    return this.#session;
  }

  /**
   * The current state, if there is one.
   *
   * @returns {import('./core/state.js').GameState | null}
   */
  get state() {
    return this.#state;
  }

  /**
   * Starts the app: joins a room if the URL names one, otherwise shows the
   * home screen.
   *
   * @returns {Promise<void>}
   */
  async start() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('room');
    const code = roomCodeFromLocation();

    if (code) {
      // A player who has been here before goes straight in. A first-time
      // guest picks a name first.
      if (this.#hasName) {
        await this.joinRoom(code);
      } else {
        this.#renderJoin(code);
      }
      return;
    }

    this.#renderHome();

    // A room was asked for but the code is not valid. Say so, rather than
    // silently showing the home screen as if nothing had happened.
    if (requested) {
      this.#home?.showJoinError();
    }
  }

  /**
   * Renders the join screen.
   *
   * @param {string} code
   */
  #renderJoin(code) {
    this.#screen = 'join';
    clear(this.options.screenRoot);

    // Show the room the guest is about to join, so they can confirm it is
    // the right one before they commit.
    this.#code = code;
    this.#renderRoomBar();

    const join = createJoinScreen({
      code,
      name: this.#playerName === 'Player' ? '' : this.#playerName,
      avatar: this.#playerAvatar,
      onJoin: (name, avatarIndex) => {
        this.#playerName = name;
        this.#playerAvatar = avatarIndex;
        this.#hasName = true;
        void this.joinRoom(code);
      },
      onLanguageChange: () => this.#renderJoin(code),
    });

    this.options.screenRoot.append(join.element);
  }

  /**
   * Creates a room and becomes its Host.
   *
   * @param {import('./core/state.js').Rules} [rules]
   * @returns {Promise<string>} The room code.
   */
  async createRoom(rules = DEFAULT_RULES) {
    const session = new HostSession({
      factory: createPeer,
      rng: createRandomRng(),
      rules,
      hostName: this.#playerName,
      hostAvatar: this.#playerAvatar,
      hostLocale: this.#locale,
    });

    this.#session = session;
    this.#wireSession(session);

    showBanner(this.options.bannerRoot, {
      text: t('common.loading'),
      kind: 'info',
    });

    const code = await session.start();

    hideBanner(this.options.bannerRoot);

    this.#code = code;
    this.#state = session.state;

    // The shareable link carries the code, so a player only has to open it.
    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url);

    this.#renderRoom();
    return code;
  }

  /**
   * Joins an existing room.
   *
   * @param {string} code
   * @returns {Promise<void>}
   */
  async joinRoom(code) {
    const session = new GuestSession({
      factory: createPeer,
      code,
      name: this.#playerName,
      avatar: this.#playerAvatar,
      locale: this.#locale,
    });

    this.#session = session;
    this.#code = code;
    this.#wireSession(session);

    this.#renderJoining();
    session.start();
  }

  /**
   * Leaves the current room.
   */
  leave() {
    this.#session?.close();
    this.#session = null;
    this.#code = null;
    this.#state = null;

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url);

    this.#renderHome();
  }

  /**
   * Copies the share link.
   */
  async copyLink() {
    const url = this.#shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast(this.options.toastRoot, { text: t('create.copied'), kind: 'success' });
    } catch {
      showToast(this.options.toastRoot, { text: url, kind: 'info', durationMs: 6000 });
    }
  }

  /**
   * Shares the room, using the Web Share API when it is available.
   */
  async share() {
    const url = this.#shareUrl();
    const payload = {
      title: t('app.title'),
      text: t('create.subtitle'),
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // The player dismissed the share sheet, or it failed. Fall through.
      }
    }

    await this.copyLink();
  }

  /**
   * The shareable link for the current room.
   *
   * @returns {string}
   */
  #shareUrl() {
    const url = new URL(window.location.href);
    if (this.#code) url.searchParams.set('room', this.#code);
    return url.toString();
  }

  /* ------------------------------------------------------------------ *
   * Session wiring
   * ------------------------------------------------------------------ */

  /**
   * Wires a session's events to the application.
   *
   * @param {HostSession | GuestSession} session
   */
  #wireSession(session) {
    session.on('state', (state) => this.#onState(state));
    session.on('chat', (chat) => this.#onChat(chat));
    session.on('toast', (toast) => this.#onToast(toast));
    session.on('bye', (bye) => this.#onBye(bye));

    session.on('status', (detail) => {
      if (detail.state === LinkState.RETRYING) {
        this.#showReconnecting(detail);
      } else if (detail.state === LinkState.OPEN) {
        this.#hideReconnecting();
      } else if (detail.state === LinkState.FAILED) {
        this.#onJoinFailed(detail.reason);
      }
    });

    session.on('error', (error) => this.#onJoinFailed(error.reason));

    if (session instanceof GuestSession) {
      // The guest introduces itself as soon as the channel is open.
      session.on('status', (detail) => {
        if (detail.state === LinkState.OPEN) {
          session.sendHello();
        }
      });
    }
  }

  /**
   * Handles a new state snapshot.
   *
   * @param {import('./core/state.js').GameState} state
   */
  #onState(state) {
    const previousPhase = this.#state?.phase;
    this.#state = state;

    if (state.phase === Phase.FINISHED) {
      this.#renderResult();
      return;
    }

    if (state.phase === Phase.PLAYING) {
      if (previousPhase !== Phase.PLAYING) {
        this.#renderGame();
      }
      this.#game?.update(state);
      return;
    }

    // The lobby. The Host is already in the waiting room; a guest arrives
    // there as soon as the first state reaches it.
    if (this.#screen !== 'room') {
      this.#renderRoom();
      return;
    }

    this.#room?.update(state);
  }

  /**
   * Handles a chat message.
   *
   * @param {{ from: string, name: string, text: string, at: number }} chat
   */
  #onChat(chat) {
    this.#room?.appendChat(chat);
    this.#game?.appendChat(chat);
  }

  /**
   * Handles a toast from the Host.
   *
   * @param {{ kind: string, text: string }} toast
   */
  #onToast(toast) {
    const kind = toast.kind === 'error' || toast.kind === 'warning' ? toast.kind : 'info';
    showToast(this.options.toastRoot, { text: toast.text, kind });
  }

  /**
   * Handles the Host leaving.
   *
   * @param {{ reason: string }} _bye
   */
  #onBye(_bye) {
    playSfx('lose');
    this.#renderEnded(t('game.hostLeft'), t('game.hostLeftHint'));
  }

  /**
   * Handles a failure to join.
   *
   * @param {unknown} reason
   */
  #onJoinFailed(reason) {
    hideBanner(this.options.bannerRoot);

    if (reason === LinkFailure.ROOM_NOT_FOUND) {
      this.#renderEnded(t('game.roomNotFound'), t('game.roomNotFoundHint'));
      return;
    }

    if (reason === LinkFailure.UNSUPPORTED) {
      this.#renderEnded(t('game.signalingDown'), t('game.signalingDownHint'));
      return;
    }

    this.#renderEnded(t('game.signalingDown'), t('game.signalingDownHint'));
  }

  /**
   * Shows the reconnecting banner with a live countdown.
   *
   * @param {{ nextDelayMs?: number }} detail
   */
  #showReconnecting(detail) {
    const total = Math.max(1, Math.round((detail.nextDelayMs ?? 1000) / 1000));
    let remaining = total;

    const paint = () => {
      showBanner(this.options.bannerRoot, {
        text: t('game.reconnecting'),
        hint: t('game.reconnectingHint', { n: remaining }),
        kind: 'warning',
      });
    };

    paint();

    if (this.#countdownTimer) clearInterval(this.#countdownTimer);
    this.#countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (this.#countdownTimer) clearInterval(this.#countdownTimer);
        this.#countdownTimer = null;
        return;
      }
      paint();
    }, 1000);
  }

  /**
   * Hides the reconnecting banner.
   */
  #hideReconnecting() {
    if (this.#countdownTimer) clearInterval(this.#countdownTimer);
    this.#countdownTimer = null;
    hideBanner(this.options.bannerRoot);
  }

  /* ------------------------------------------------------------------ *
   * Screens
   * ------------------------------------------------------------------ */

  /**
   * Renders the home screen.
   */
  #renderHome() {
    this.#screen = 'home';
    clear(this.options.screenRoot);
    this.#renderRoomBar();

    const home = createHomeScreen({
      onLanguageChange: () => this.#rerender(),
      onCreate: () => {
        unlockAudio();
        const name = home.name();
        if (name) this.setPlayerName(name);
        void this.createRoom();
      },
      onJoin: (code) => {
        unlockAudio();
        const name = home.name();
        if (name) this.setPlayerName(name);

        const parsed = parseRoomCode(code);
        if (!parsed) {
          home.showJoinError();
          vibrate([12, 60, 12]);
          return;
        }
        void this.joinRoom(parsed);
      },
    });

    this.#home = home;
    this.options.screenRoot.append(home.element);
  }

  /**
   * Renders the "joining" placeholder.
   */
  #renderJoining() {
    clear(this.options.screenRoot);
    this.#renderRoomBar();

    this.options.screenRoot.append(
      el('div.flex.flex-1.items-center.justify-center.px-4', {}, [
        el('div.glass.flex.flex-col.items-center.gap-3.p-8.text-center', {}, [
          el('span.animate-breathe.h-4.w-4.rounded-full.bg-mint', { 'aria-hidden': 'true' }),
          el('p.font-display.text-lg.font-extrabold', { text: t('app.loading') }),
          el('p.text-xs.text-muted', { text: t('create.waitingHint') }),
        ]),
      ]),
    );
  }

  /**
   * Renders the waiting room.
   */
  #renderRoom() {
    this.#screen = 'room';
    clear(this.options.screenRoot);
    this.#renderRoomBar();

    const state = this.#state;
    if (!state) return;

    const isHost = this.#session instanceof HostSession;

    const room = createRoomScreen({
      state,
      selfId: this.#selfId(),
      isHost,
      onChat: (text) => {
        if (this.#session instanceof HostSession) this.#session.sendChat(text);
        else if (this.#session instanceof GuestSession) this.#session.sendChat(text);
      },
      onStart: () => {
        if (!(this.#session instanceof HostSession)) return;
        const secret = generateSecret(createRandomRng(), {
          digits: state.rules.digits,
          allowRepeats: state.rules.allowRepeats,
        });
        this.#session.beginGame(secret);
        playSfx('join');
      },
      onCopy: () => void this.copyLink(),
      onShare: () => void this.share(),
    });

    this.#room = room;
    this.options.screenRoot.append(room.element);
    room.update(state);
  }

  /**
   * Renders the game screen.
   */
  #renderGame() {
    this.#screen = 'game';
    clear(this.options.screenRoot);
    this.#renderRoomBar();

    const state = this.#state;
    if (!state) return;

    const game = createGameScreen({
      state,
      selfId: this.#selfId(),
      onGuess: (digits) => {
        if (this.#session instanceof HostSession) {
          this.#session.playLocal(digits);
        } else if (this.#session instanceof GuestSession) {
          this.#session.sendGuess(digits);
        }
      },
      onChat: (text) => {
        if (this.#session instanceof HostSession) this.#session.sendChat(text);
        else if (this.#session instanceof GuestSession) this.#session.sendChat(text);
      },
    });

    this.#game = game;
    this.options.screenRoot.append(game.element);
    game.update(state);
  }

  /**
   * Renders the result screen.
   */
  #renderResult() {
    this.#screen = 'result';
    clear(this.options.screenRoot);
    this.#renderRoomBar();

    const state = this.#state;
    if (!state) return;

    const isHost = this.#session instanceof HostSession;

    const result = createResultScreen({
      state,
      selfId: this.#selfId(),
      isHost,
      onRestart: () => {
        if (!(this.#session instanceof HostSession)) return;
        const secret = generateSecret(createRandomRng(), {
          digits: state.rules.digits,
          allowRepeats: state.rules.allowRepeats,
        });
        this.#session.beginGame(secret);
        this.#renderGame();
      },
      onHome: () => this.leave(),
    });

    this.options.screenRoot.append(result.element);
    playSfx('win');
    vibrate([20, 60, 20, 60, 40]);
  }

  /**
   * Renders the "the room is over" screen.
   *
   * @param {string} title
   * @param {string} hint
   */
  #renderEnded(title, hint) {
    this.#screen = 'ended';
    clear(this.options.screenRoot);
    this.#renderRoomBar();

    const home = el(
      'div.flex.flex-1.items-center.justify-center.px-4.py-8',
      {
        'data-screen': 'ended',
      },
      [
        el('section.glass.flex.max-w-md.flex-col.items-center.gap-3.p-8.text-center', {}, [
          el('span.text-rose', {}, [icon('warning', 40)]),
          el('h1.font-display.text-2xl.font-extrabold', { text: title }),
          el('p.text-sm.text-muted', { text: hint }),
          el(
            'button.mt-2.rounded-2xl.bg-violet.px-6.py-3.text-base.font-extrabold.text-text',
            { type: 'button', 'data-action': 'back-home' },
            [t('result.backHome')],
          ),
        ]),
      ],
    );

    home.querySelector('button')?.addEventListener('click', () => this.leave());
    this.options.screenRoot.append(home);
  }

  /**
   * Rebuilds the current screen.
   *
   * The interface is built from the locale tables, so a language change
   * means the screen has to be built again — otherwise the buttons would
   * still say the old thing.
   */
  #rerender() {
    switch (this.#screen) {
      case 'join':
        this.#renderJoin(this.#code ?? '');
        return;
      case 'room':
        this.#renderRoom();
        return;
      case 'game':
        this.#renderGame();
        return;
      case 'result':
        this.#renderResult();
        return;
      case 'ended':
        this.#renderEnded(t('game.hostLeft'), t('game.hostLeftHint'));
        return;
      default:
        this.#renderHome();
    }
  }

  /**
   * The id of the player this browser is.
   *
   * @returns {string | null}
   */
  #selfId() {
    if (this.#session instanceof HostSession) return 'host';
    if (this.#session instanceof GuestSession) return this.#session.self?.id ?? null;
    return null;
  }

  /**
   * Renders the pinned room bar.
   */
  #renderRoomBar() {
    clear(this.options.roomBar);
    if (!this.#code) return;
    this.options.roomBar.append(this.#buildRoomBar());
  }

  /**
   * Builds the room bar.
   *
   * @returns {HTMLElement}
   */
  #buildRoomBar() {
    const hasSession = this.#session !== null;
    const code = this.#code ?? '';
    const url = this.#shareUrl();

    const bar = el('div.flex.items-center.gap-3', {}, []);

    const chip = el('div.flex.items-center.gap-2.rounded-xl.bg-violet-deep/60.px-3.py-1.5', {}, [
      el('span.text-faint.text-xs.font-semibold.uppercase.tracking-wider', {
        text: t('create.codeLabel'),
      }),
      el('span.tnum.text-xl.font-extrabold.tracking-[0.3em].text-mint', {
        text: code,
        'data-testid': 'room-code',
        'aria-label': `${t('create.codeLabel')}: ${code.split('').join(' ')}`,
      }),
    ]);

    const actions = el('div.ms-auto.flex.items-center.gap-2');

    const copy = el(
      'button.inline-flex.h-11.w-11.items-center.justify-center.rounded-xl.bg-panel-soft.text-text.transition-colors.hover:bg-violet-deep',
      {
        type: 'button',
        'data-action': 'copy-link',
        'aria-label': t('create.copyLink'),
        title: t('create.copyLink'),
      },
      [icon('copy', 20)],
    );
    copy.addEventListener('click', () => void this.copyLink());

    const share = el(
      'button.inline-flex.h-11.w-11.items-center.justify-center.rounded-xl.bg-panel-soft.text-text.transition-colors.hover:bg-violet-deep',
      {
        type: 'button',
        'data-action': 'share',
        'aria-label': t('create.share'),
        title: t('create.share'),
      },
      [icon('share', 20)],
    );
    share.addEventListener('click', () => void this.share());

    const leave = el(
      'button.inline-flex.h-11.w-11.items-center.justify-center.rounded-xl.bg-rose-deep/40.text-rose.transition-colors.hover:bg-rose-deep/70',
      {
        type: 'button',
        'data-action': 'leave',
        'aria-label': t('lobby.leave'),
        title: t('lobby.leave'),
      },
      [icon('leave', 20)],
    );
    leave.addEventListener('click', () => this.leave());

    actions.append(copy, share);

    // There is nothing to leave before joining.
    if (hasSession) {
      actions.append(leave);
    }

    actions.append(
      createLanguageToggle(() => {
        this.#rerender();
      }),
    );

    bar.append(chip, actions);
    bar.dataset.shareUrl = url;

    return bar;
  }
}
