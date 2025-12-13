import { io, Socket } from 'socket.io-client';

/**
 * Reconnection state for UI updates
 */
export type ReconnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'failed';

/**
 * Callback type for reconnection state changes
 */
export type ReconnectionCallback = (state: ReconnectionState, attemptNumber?: number) => void;

/**
 * SocketService
 *
 * Wrapper around Socket.io client for WebSocket communication.
 * Handles connection management, reconnection, and event handling.
 */
class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;
  private reconnectionCallbacks: Set<ReconnectionCallback> = new Set();
  private reconnectionState: ReconnectionState = 'disconnected';

  constructor() {
    this.serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.setReconnectionState('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.setReconnectionState('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    // Reconnection events
    this.socket.io.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnection attempt:', attemptNumber);
      this.setReconnectionState('reconnecting', attemptNumber);
    });

    this.socket.io.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      this.setReconnectionState('connected');
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after all attempts');
      this.setReconnectionState('failed');
    });

    return this.socket;
  }

  /**
   * Set reconnection state and notify callbacks
   */
  private setReconnectionState(state: ReconnectionState, attemptNumber?: number): void {
    this.reconnectionState = state;
    this.reconnectionCallbacks.forEach(callback => callback(state, attemptNumber));
  }

  /**
   * Subscribe to reconnection state changes
   */
  onReconnectionStateChange(callback: ReconnectionCallback): () => void {
    this.reconnectionCallbacks.add(callback);
    // Immediately call with current state
    callback(this.reconnectionState);
    // Return unsubscribe function
    return () => {
      this.reconnectionCallbacks.delete(callback);
    };
  }

  /**
   * Get current reconnection state
   */
  getReconnectionState(): ReconnectionState {
    return this.reconnectionState;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Get current socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Emit event to server
   */
  emit<T>(event: string, data: T): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(event, data);
  }

  /**
   * Listen for event from server
   */
  on<T>(event: string, callback: (data: T) => void): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (!this.socket) {
      return;
    }
    this.socket.off(event, callback);
  }
}

// Export singleton instance
export const socketService = new SocketService();
