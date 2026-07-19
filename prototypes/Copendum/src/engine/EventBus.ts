// Lightweight typed pub/sub event bus.
// Used to coordinate audio, particles, UI animations without prop drilling.

type Handler = (payload?: unknown) => void;

class EventBus {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, payload?: unknown): void {
    this.listeners.get(event)?.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error(`[EventBus] handler error for "${event}":`, e);
      }
    });
  }
}

export const bus = new EventBus();

// Named event constants to prevent typos.
export const AppEvents = {
  CARD_HOVER: "card:hover",
  CARD_SELECT: "card:select",
  CARD_CLOSE: "card:close",
  PAGE_TURN: "page:turn",
  SEARCH_CHANGE: "search:change",
  MUSIC_TOGGLE: "music:toggle",
} as const;
