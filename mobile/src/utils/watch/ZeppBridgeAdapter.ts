/**
 * Qs Poke Buddy - Zepp OS (Amazfit) Bridge Adapter
 * Interacts with Zepp OS Side Service via Localhost Loopback HTTP (127.0.0.1:8088).
 */
import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { WatchBridgeAdapter } from './WatchBridgeAdapter';
import { WatchMessage, WatchAdapterStatus } from '../../types/watch';

const { WatchBridge } = NativeModules;

export class ZeppBridgeAdapter implements WatchBridgeAdapter {
  readonly providerType = 'zepp' as const;
  readonly providerName = 'Zepp OS (Amazfit)';

  private messageListeners = new Set<(message: WatchMessage) => void>();
  private isInit = false;
  private lastSyncTime: number | null = null;
  private nativeSubscription: any = null;

  async initialize(): Promise<boolean> {
    if (this.isInit) return true;

    // Listen to native incoming operations dispatched from Android loopback HTTP server
    this.nativeSubscription = DeviceEventEmitter.addListener(
      'onWatchOperationReceived',
      (rawPayload: any) => {
        try {
          const parsed: WatchMessage =
            typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;

          if (parsed) {
            this.lastSyncTime = Date.now();
            this.messageListeners.forEach((listener) => listener(parsed));
          }
        } catch (e) {
          console.warn('[ZeppBridgeAdapter] Failed to parse inbound native message:', e);
        }
      }
    );

    this.isInit = true;
    return true;
  }

  async isWatchConnected(): Promise<boolean> {
    return true;
  }

  async sendMessage<T = any>(message: WatchMessage<T>): Promise<boolean> {
    if (!this.isInit) await this.initialize();
    return true;
  }

  onMessageReceived(listener: (message: WatchMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  async getStatus(): Promise<WatchAdapterStatus> {
    return {
      provider: 'zepp',
      isConnected: true,
      isAvailable: true,
      deviceName: 'Amazfit Watch (Zepp OS)',
      lastSyncTimestamp: this.lastSyncTime,
      pendingQueueCount: 0,
    };
  }

  dispose(): void {
    if (this.nativeSubscription?.remove) {
      this.nativeSubscription.remove();
    }
    this.messageListeners.clear();
    this.isInit = false;
  }
}
