/**
 * Contact Service (Chat Business Logic)
 *
 * Extracted from OneCoreHandler - chat-specific contact management.
 * Provides contact list with LAMA-specific enhancements:
 * - AI contact detection
 * - Avatar color management
 * - No caching (LeuteModel already caches)
 * - Deduplication
 */
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
export interface Contact {
    id: string;
    personId: string;
    someoneId?: string;
    name: string;
    displayName: string;
    email: string;
    isAI: boolean;
    modelId?: string;
    role: string;
    platform: string;
    status: string;
    isConnected: boolean;
    trusted: boolean;
    lastSeen: string;
    color: string;
}
/**
 * ContactService - Contact management with LAMA-specific features
 */
export declare class ContactService {
    private leuteModel;
    private aiAssistantModel;
    constructor(leuteModel: LeuteModel, aiAssistantModel?: any);
    /**
     * Invalidate contacts cache (deprecated - no-op)
     */
    invalidateContactsCache(): void;
    /**
     * Get contacts from LeuteModel with LAMA-specific enhancements
     */
    getContacts(): Promise<Contact[]>;
    /**
     * Get peer list (simplified contact format)
     */
    getPeerList(): Promise<any[]>;
}
//# sourceMappingURL=ContactService.d.ts.map