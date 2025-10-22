/**
 * IOM Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for IoM operations.
 * Delegates to one.models ConnectionsModel and ChannelManager.
 * Platform-specific operations (fs, storage) are injected.
 *
 * Can be used from both Electron IPC and Web Worker contexts.
 */
export interface GetIOMInstancesRequest {
}
export interface GetIOMInstancesResponse {
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
}
export interface CreatePairingInvitationResponse {
    success: boolean;
    invitation?: {
        url: string;
        token: string;
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
 * IOMHandler - Pure business logic for IoM operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - nodeOneCore: Platform-specific ONE.core instance
 * - storageProvider: Platform-specific storage info provider (optional)
 */
export declare class IOMHandler {
    private nodeOneCore;
    private storageProvider;
    constructor(nodeOneCore: any, storageProvider?: any);
    /**
     * Get IOM instances - delegates to one.models
     */
    getIOMInstances(request: GetIOMInstancesRequest): Promise<GetIOMInstancesResponse>;
    /**
     * Create pairing invitation - delegates to ConnectionsModel.pairing
     */
    createPairingInvitation(request: CreatePairingInvitationRequest): Promise<CreatePairingInvitationResponse>;
    /**
     * Accept pairing invitation - delegates to ConnectionsModel.pairing
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
//# sourceMappingURL=IOMHandler.d.ts.map