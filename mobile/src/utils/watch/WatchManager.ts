/**
 * Qs Poke Buddy - Central Watch Manager & Event Bus
 * Decouples mobile business logic from individual smartwatch vendor hardware.
 */
import { WatchBridgeAdapter } from './WatchBridgeAdapter';
import { ZeppBridgeAdapter } from './ZeppBridgeAdapter';
import { GarminBridgeAdapter } from './GarminBridgeAdapter';
import {
  WatchMessage,
  WatchEventType,
  WatchProviderType,
  WatchAdapterStatus,
} from '../../types/watch';

export type WatchEventHandler<T = any> = (data: T, message: WatchMessage<T>) => void | Promise<void>;

export class WatchManager {
  private static instance: WatchManager;

  private adapters: Map<WatchProviderType, WatchBridgeAdapter> = new Map();
  private activeProvider: WatchProviderType = 'zepp';
  private activeAdapter: WatchBridgeAdapter | null = null;

  private eventSubscribers: Map<WatchEventType, Set<WatchEventHandler>> = new Map();
  private offlineQueue: WatchMessage[] = [];
  private processedEventIds = new Set<string>();
  private readonly maxProcessedHistory = 500;

  private isStarted = false;

  private constructor() {
    // Register built-in adapters
    this.registerAdapter(new ZeppBridgeAdapter());
    this.registerAdapter(new GarminBridgeAdapter());
  }

  public static getInstance(): WatchManager {
    if (!WatchManager.instance) {
      WatchManager.instance = new WatchManager();
    }
    return WatchManager.instance;
  }

  public registerAdapter(adapter: WatchBridgeAdapter): void {
    this.adapters.set(adapter.providerType, adapter);
  }

  public async setProvider(provider: WatchProviderType): Promise<void> {
    if (this.activeProvider === provider && this.activeAdapter) {
      return;
    }

    if (this.activeAdapter) {
      this.activeAdapter.dispose();
      this.activeAdapter = null;
    }

    this.activeProvider = provider;
    const adapter = this.adapters.get(provider);

    if (adapter) {
      this.activeAdapter = adapter;
      adapter.onMessageReceived((msg) => this.handleInboundMessage(msg));
      await adapter.initialize();
      console.log(`[WatchManager] Switched active watch provider to: ${adapter.providerName}`);
    } else {
      console.warn(`[WatchManager] Provider '${provider}' not found in registry.`);
    }
  }

  public getActiveProvider(): WatchProviderType {
    return this.activeProvider;
  }

  public async initialize(defaultProvider: WatchProviderType = 'zepp'): Promise<void> {
    if (this.isStarted) return;
    await this.setProvider(defaultProvider);
    this.isStarted = true;
  }

  /**
   * Subscribe to specific standardized watch events (e.g. 'TASK_COMPLETE', 'WATER_LOG')
   */
  public on<T = any>(event: WatchEventType, handler: WatchEventHandler<T>): () => void {
    if (!this.eventSubscribers.has(event)) {
      this.eventSubscribers.set(event, new Set());
    }
    const set = this.eventSubscribers.get(event)!;
    set.add(handler);

    return () => {
      set.delete(handler);
    };
  }

  /**
   * Handle incoming standardized watch messages, performing deduplication and dispatching
   */
  public async handleInboundMessage(message: WatchMessage): Promise<void> {
    if (!message || !message.event) return;

    // Deduplication check
    if (message.eventId) {
      if (this.processedEventIds.has(message.eventId)) {
        console.log(`[WatchManager] Dropping duplicate event: ${message.eventId}`);
        return;
      }
      this.processedEventIds.add(message.eventId);

      // Bound cache size
      if (this.processedEventIds.size > this.maxProcessedHistory) {
        const firstKey = this.processedEventIds.values().next().value;
        if (firstKey) this.processedEventIds.delete(firstKey);
      }
    }

    console.log(`[WatchManager] Dispatching [${message.event}] from [${message.provider || this.activeProvider}]:`, message.data);

    const handlers = this.eventSubscribers.get(message.event);
    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          await handler(message.data, message);
        } catch (e) {
          console.error(`[WatchManager] Error in event handler for ${message.event}:`, e);
        }
      }
    }
  }

  /**
   * Send a standardized message down to the active watch
   */
  public async emitToWatch<T = any>(
    event: WatchEventType,
    data: T,
    eventId?: string
  ): Promise<boolean> {
    const message: WatchMessage<T> = {
      eventId: eventId || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      event,
      provider: this.activeProvider,
      data,
    };

    if (!this.activeAdapter) {
      console.warn('[WatchManager] No active adapter. Enqueueing message.');
      this.offlineQueue.push(message);
      return false;
    }

    const connected = await this.activeAdapter.isWatchConnected();
    if (!connected) {
      console.log('[WatchManager] Watch offline. Enqueueing message.');
      this.offlineQueue.push(message);
      return false;
    }

    // Flush any pending offline messages
    await this.flushOfflineQueue();

    return await this.activeAdapter.sendMessage(message);
  }

  /**
   * Flush queued messages once connection is restored
   */
  private async flushOfflineQueue(): Promise<void> {
    if (!this.activeAdapter || this.offlineQueue.length === 0) return;

    console.log(`[WatchManager] Flushing ${this.offlineQueue.length} queued offline messages...`);
    while (this.offlineQueue.length > 0) {
      const msg = this.offlineQueue.shift()!;
      try {
        await this.activeAdapter.sendMessage(msg);
      } catch (e) {
        // Put back at head if transmission failed
        this.offlineQueue.unshift(msg);
        break;
      }
    }
  }

  public async getStatus(): Promise<WatchAdapterStatus> {
    if (!this.activeAdapter) {
      return {
        provider: this.activeProvider,
        isConnected: false,
        isAvailable: false,
        lastSyncTimestamp: null,
        pendingQueueCount: this.offlineQueue.length,
      };
    }
    const status = await this.activeAdapter.getStatus();
    return {
      ...status,
      pendingQueueCount: this.offlineQueue.length,
    };
  }
}

export const watchManager = WatchManager.getInstance();
