/**
 * A tiny synchronous event emitter.
 *
 * The network layer needs to publish state changes, and the app must not depend
 * on a DOM `EventTarget` (which would make the transport untestable outside a
 * browser) nor on an event-emitter library (which would be a dependency for
 * forty lines of code).
 */

/**
 * @template {string} TEvent
 * @template {unknown[]} TArgs
 */
export class Emitter {
  /** @type {Map<TEvent, Set<(...args: TArgs) => void>>} */
  #listeners = new Map();

  /**
   * Subscribes to an event.
   *
   * @param {TEvent} event
   * @param {(...args: TArgs) => void} listener
   * @returns {() => void} A function that unsubscribes.
   */
  on(event, listener) {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  /**
   * Subscribes to an event for exactly one delivery.
   *
   * @param {TEvent} event
   * @param {(...args: TArgs) => void} listener
   * @returns {() => void}
   */
  once(event, listener) {
    const off = this.on(event, (...args) => {
      off();
      listener(...args);
    });
    return off;
  }

  /**
   * Unsubscribes a listener.
   *
   * @param {TEvent} event
   * @param {(...args: TArgs) => void} listener
   */
  off(event, listener) {
    this.#listeners.get(event)?.delete(listener);
  }

  /**
   * Publishes an event.
   *
   * A listener that throws does not prevent the remaining listeners from
   * running — one broken subscriber must not take down the transport.
   *
   * @param {TEvent} event
   * @param {...TArgs} args
   */
  emit(event, ...args) {
    const set = this.#listeners.get(event);
    if (!set) return;

    for (const listener of [...set]) {
      try {
        const call = /** @type {(...a: TArgs) => void} */ (listener);
        call(.../** @type {TArgs} */ (args));
      } catch (error) {
        console.error('[emitter] a listener threw', error);
      }
    }
  }

  /**
   * Removes every listener.
   */
  clear() {
    this.#listeners.clear();
  }
}
