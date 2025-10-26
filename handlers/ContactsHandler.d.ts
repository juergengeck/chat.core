/**
 * Contacts Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for contact management operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api handler architecture.
 */
export interface Contact {
    id: string;
    personId: string;
    name: string;
    isAI: boolean;
    modelId?: string;
    canMessage: boolean;
    isConnected: boolean;
}
export interface ContactWithTrust extends Contact {
    trustLevel: string;
    canSync: boolean;
    discoverySource: string;
    discoveredAt: number;
}
export interface GetContactsResponse {
    success: boolean;
    contacts?: Contact[];
    error?: string;
}
export interface GetContactsWithTrustResponse {
    success: boolean;
    contacts?: ContactWithTrust[];
    error?: string;
}
/**
 * ContactsHandler - Pure business logic for contact operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - nodeOneCore: Platform-specific ONE.core instance
 */
export declare class ContactsHandler {
    private nodeOneCore;
    constructor(nodeOneCore: any);
    /**
     * Get all contacts
     */
    getContacts(): Promise<GetContactsResponse>;
    /**
     * Get all contacts with trust information
     */
    getContactsWithTrust(): Promise<GetContactsWithTrustResponse>;
    /**
     * Get pending contacts (contacts awaiting acceptance)
     */
    getPendingContacts(): Promise<{
        success: boolean;
        pendingContacts?: any[];
        error?: string;
    }>;
    /**
     * Get specific pending contact details
     */
    getPendingContact(pendingId: string): Promise<{
        success: boolean;
        pendingContact?: any;
        error?: string;
    }>;
    /**
     * Accept a pending contact (update trust level)
     */
    acceptContact(personId: string, options?: any): Promise<{
        success: boolean;
        error?: string;
        [key: string]: any;
    }>;
    /**
     * Block a contact
     */
    blockContact(personId: string, reason: string): Promise<{
        success: boolean;
        error?: string;
        [key: string]: any;
    }>;
    /**
     * Reject a pending contact
     */
    rejectContact(pendingId: string, reason: string): Promise<{
        success: boolean;
        error?: string;
        [key: string]: any;
    }>;
    /**
     * Add a new contact
     */
    addContact(personInfo: {
        name: string;
        email: string;
    }): Promise<{
        success: boolean;
        contact?: any;
        error?: string;
    }>;
    /**
     * Remove a contact
     */
    removeContact(contactId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Revoke contact's VC
     */
    revokeContactVC(personId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get all groups using core Group objects
     */
    getGroups(): Promise<{
        success: boolean;
        groups?: any[];
        error?: string;
    }>;
    /**
     * Create a new group using core Group object
     */
    createGroup(name: string, memberIds?: string[]): Promise<{
        success: boolean;
        group?: any;
        error?: string;
    }>;
    /**
     * Add contacts to a group (core Group pattern)
     */
    addContactsToGroup(groupId: string, contactIds: string[]): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Remove contacts from a group (core Group pattern)
     */
    removeContactsFromGroup(groupId: string, contactIds: string[]): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get group members (core Group pattern)
     */
    getGroupMembers(groupId: string): Promise<{
        success: boolean;
        members?: any[];
        error?: string;
    }>;
    /**
     * Delete a group - NOTE: Groups cannot be truly deleted in ONE.core
     * This marks the group as deleted by removing all members
     */
    deleteGroup(groupId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=ContactsHandler.d.ts.map