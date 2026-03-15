/**
 * Typed event emitter for internal pub/sub.
 * Used to decouple PTY output from WebSocket delivery.
 */

type Listener<T> = (data: T) => void;

export class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<any>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// ── App-level events ───────────────────────────────────────

import type { Session, EventKind } from "./types.ts";

export interface AppEvents {
  "session:output": { sessionId: string; kind: EventKind; data: string };
  "session:update": { session: Session };
  "session:exit": { sessionId: string; code: number | null };
}

export const bus = new TypedEmitter<AppEvents>();
