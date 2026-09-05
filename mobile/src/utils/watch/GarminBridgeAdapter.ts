/**
 * Qs Poke Buddy - Garmin (Connect IQ) Bridge Adapter
 * Interacts with Garmin Connect Mobile (GCM) and Connect IQ Android SDK.
 */
import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { WatchBridgeAdapter } from './WatchBridgeAdapter';
import { WatchMessage, WatchAdapterStatus } from '../../types/watch';

const { WatchBridge } = NativeModules;

export class GarminBridgeAdapter implements WatchBridgeAdapter {
  readonly providerType = 'garmin' as const;
  readonly providerName = 'Garmin (Connect IQ)';

  private messageListeners = new Set<(message: WatchMessage) => void>();
  private isInit = false;
  private lastSyncTime: number | null = null;
  private nativeSubscription: any = null;

  async initialize(): Promise<boolean> {
    if (this.isInit) return true;

    // Listen to native incoming events dispatched from Garmin ConnectIQ SDK
    this.nativeSubscription = DeviceEventEmitter.addListener(
      'onGarminMessageReceived',
      (rawPayload: any) => {
        try {
          const parsed: WatchMessage =
            typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;

          if (parsed && parsed.event) {
            this.lastSyncTime = Date.now();
            this.messageListeners.forEach((listener) => listener(parsed));
          }
        } catch (e) {
          console.warn('[GarminBridgeAdapter] Error parsing Garmin payload:', e);
        }
      }
    );

    if (Platform.OS === 'android' && WatchBridge?.initGarminSdk) {
      try {
        await WatchBridge.initGarminSdk();
      } catch (e) {
        console.warn('[GarminBridgeAdapter] Garmin SDK init notice:', e);
      }
    }

    this.isInit = true;
    console.log('[GarminBridgeAdapter] Initialized.');
    return true;
  }

  async isWatchConnected(): Promise<boolean> {
    if (Platform.OS === 'android' && WatchBridge?.isGarminConnected) {
      try {
        return await WatchBridge.isGarminConnected();
      } catch {
        return false;
      }
    }
    return true;
  }

  async sendMessage<T = any>(message: WatchMessage<T>): Promise<boolean> {
    if (!this.isInit) await this.initialize();

    const payloadJson = JSON.stringify(message);

    if (Platform.OS === 'android' && WatchBridge?.sendToGarmin) {
      try {
        const result = await WatchBridge.sendToGarmin(payloadJson);
        return !!result;
      } catch (e) {
        console.warn('[GarminBridgeAdapter] Failed to send message to Garmin:', e);
        return false;
      }
    }

    console.log('[GarminBridgeAdapter] Message dispatched to Garmin (Simulated):', message.event);
    return true;
  }

  onMessageReceived(listener: (message: WatchMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  async getStatus(): Promise<WatchAdapterStatus> {
    const isConnected = await this.isWatchConnected();
    return {
      provider: 'garmin',
      isConnected,
      isAvailable: true,
      deviceName: 'Garmin Watch (Connect IQ)',
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
