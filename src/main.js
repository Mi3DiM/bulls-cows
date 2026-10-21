import './styles/main.css';
import './styles/game.css';

/**
 * Application bootstrap.
 *
 * The screen router and the session wiring are added in the UI phase; this
 * entry point is the stable seam they plug into.
 */
const screenRoot = document.querySelector('#screen-root');

if (screenRoot) {
  screenRoot.className = 'flex flex-1 items-center justify-center px-4';
  screenRoot.innerHTML = '<p class="text-muted">Bulls &amp; Cows</p>';
}
