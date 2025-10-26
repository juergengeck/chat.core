/**
 * Connection Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for connection, pairing, and instance management operations.
 * Handles both device pairing (IoM) and partner pairing (IoP).
 * Delegates to one.models ConnectionsModel and ChannelManager.
 * Platform-specific operations (fs, storage) are injected.
 *
 * Can be used from both Electron IPC and Web Worker contexts.
 */
export interface GetInstancesRequest {
}
export interface GetInstancesResponse {
    instances: Instance[];
}
export interface Instance {
    id: string;
    name: string;
    type: string;
    role: string;
    status: string;
    endpoint: string;
    storage: StorageInfo;
    lastSync: string | null;
    replication: ReplicationInfo;
}
export interface StorageInfo {
    used: number;
    total: number;
    percentage: number;
}
export interface ReplicationInfo {
    inProgress: boolean;
    lastCompleted: string | null;
    queueSize: number;
    failedItems: number;
    errors: any[];
}
export interface CreatePairingInvitationRequest {
    mode?: 'IoM' | 'IoP';
    webUrl?: string;
}
export interface CreatePairingInvitationResponse {
    success: boolean;
    invitation?: {
        url: string;
        token: string;
        mode: 'IoM' | 'IoP';
    };
    error?: string;
}
export interface AcceptPairingInvitationRequest {
    invitationUrl: string;
}
export interface AcceptPairingInvitationResponse {
    success: boolean;
    message?: string;
    error?: string;
}
export interface GetConnectionStatusRequest {
}
export interface GetConnectionStatusResponse {
    connections: any[];
    syncing: boolean;
}
/**
 * ConnectionHandler - Pure business logic for connection, pairing, and instance management
 *
 * Dependencies are injected via constructor to support both platforms:
 * - nodeOneCore: Platform-specific ONE.core instance
 * - storageProvider: Platform-specific storage info provider (optional)
 * - webUrl: Base URL for invitation web app (e.g., http://localhost:5173 for dev, https://lama.one for prod)
 */
export declare class ConnectionHandler {
    private nodeOneCore;
    private storageProvider;
    private webUrl?;
    constructor(nodeOneCore: any, storageProvider?: any, webUrl?: string);
    /**
     * Get instances - delegates to one.models
     */
    getInstances(request: GetInstancesRequest): Promise<GetInstancesResponse>;
    /**
     * Create pairing invitation - delegates to ConnectionsModel.pairing
     * Supports both IoM (device) and IoP (partner) invitation types
     */
    createPairingInvitation(request: CreatePairingInvitationRequest): Promise<CreatePairingInvitationResponse>;
    /**
     * Accept pairing invitation - delegates to ConnectionsModel.pairing
     * Includes retry logic for reliability (following one.leute pattern)
     */
    acceptPairingInvitation(request: AcceptPairingInvitationRequest): Promise<AcceptPairingInvitationResponse>;
    /**
     * Get connection status - delegates to ConnectionsModel
     */
    getConnectionStatus(request: GetConnectionStatusRequest): Promise<GetConnectionStatusResponse>;
    /**
     * Helper: Get connection status from ConnectionsModel
     */
    private getConnectionStatusFromModel;
    /**
     * Helper: Get default storage info when provider not available
     */
    private getDefaultStorage;
}
//# sourceMappingURL=ConnectionHandler.d.ts.map