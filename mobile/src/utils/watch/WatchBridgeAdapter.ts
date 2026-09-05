/**
 * Qs Poke Buddy - Abstract Watch Bridge Adapter Interface
 * Every smartwatch platform provider implements this interface.
 */
import { WatchMessage, WatchProviderType, WatchAdapterStatus } from '../../types/watch';

export interface WatchBridgeAdapter {
  readonly providerType: WatchProviderType;
  readonly providerName: string;

  /**
   * Initialize bridge resources, native listeners, and communication pipelines
   */
  initialize(): Promise<boolean>;

  /**
   * Check if smartwatch / companion runtime is currently connected via BLE / service
   */
  isWatchConnected(): Promise<boolean>;

  /**
   * Transmit a standardized message to the watch
   */
  sendMessage<T = any>(message: WatchMessage<T>): Promise<boolean>;

  /**
   * Register a listener for incoming messages from the watch
   */
  onMessageReceived(listener: (message: WatchMessage) => void): () => void;

  /**
   * Get current adapter telemetry & connection status
   */
  getStatus(): Promise<WatchAdapterStatus>;

  /**
   * Release native resources and unregister listeners
   */
  dispose(): void;
}
