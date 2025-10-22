/**
 * Contact Service (Chat Business Logic)
 *
 * Extracted from OneCoreHandler - chat-specific contact management.
 * Provides contact list with LAMA-specific enhancements:
 * - AI contact detection
 * - Avatar color management
 * - Caching (5s TTL)
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
    private contactsCache;
    private contactsCacheTime;
    private readonly CONTACTS_CACHE_TTL;
    constructor(leuteModel: LeuteModel, aiAssistantModel?: any);
    /**
     * Invalidate contacts cache
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