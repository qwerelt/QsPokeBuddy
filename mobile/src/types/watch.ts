/**
 * Qs Poke Buddy - Watch Communication Types & Event Contracts
 * Defines standard protocol envelopes and payloads for the two-boundary sync engine.
 */

export type WatchProviderType = 'zepp' | 'garmin' | 'mock';

export type WatchOperationType =
  | 'COMPLETE_TASK'
  | 'CLAIM_REWARD'
  | 'WATER_LOG'
  | 'MEAL_LOG'
  | 'STEP_DELTA'
  | 'SYNC'
  | 'GET_STATE';

export type WatchEventType =
  | 'TASK_COMPLETE'
  | 'TASK_CREATE'
  | 'WATER_LOG'
  | 'MEAL_LOG'
  | 'STEP_UPDATE'
  | 'SYNC_LEDGER'
  | 'REQUEST_SYNC'
  | 'SYNC_PAYLOAD'
  | 'PING'
  | 'PONG';

export interface WatchMessage<T = any> {
  eventId: string;
  timestamp: number;
  event: WatchEventType;
  provider?: WatchProviderType;
  data: T;
}

export interface WatchOperation<T = any> {
  operationId: string;
  type: WatchOperationType;
  payload: T;
  createdAt: number;
}

export interface WatchProtocolRequest<T = any> {
  protocolVersion: number;
  requestId: string;
  type: string;
  payload: T;
}

export interface WatchProtocolResponse<T = any> {
  protocolVersion: number;
  requestId: string;
  ok: boolean;
  type: string;
  payload?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface WatchStatePayload {
  stateVersion: number;
  pokemon: any;
  tasks: any[];
  inventory: any[];
  rewards: any[];
  rules: any;
  timestamp: number;
}

export interface TaskCompletePayload {
  taskId: string;
  timestamp?: number;
}

export interface WaterLogPayload {
  cups: number;
  timestamp?: number;
}

export interface StepDeltaPayload {
  deltaSteps: number;
  timestamp?: number;
}

export interface StepUpdatePayload {
  deltaSteps: number;
  totalSteps?: number;
  timestamp?: number;
}

export interface WatchAdapterStatus {
  provider: WatchProviderType;
  isConnected: boolean;
  isAvailable: boolean;
  deviceName?: string;
  lastSyncTimestamp: number | null;
  pendingQueueCount: number;
}
