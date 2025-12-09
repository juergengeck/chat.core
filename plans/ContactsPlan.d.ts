/**
 * Contacts Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for contact management operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api architecture.
 */
import { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
interface StoryFactory {
    recordExecution(context: any, operation: () => Promise<any>): Promise<{
        result: any;
        storyId?: any;
        assemblyId?: any;
    }>;
    registerPlan(params: any): Promise<any>;
}
export interface Contact {
    id: string;
    personId: string;
    name: string;
    email?: string;
    avatarBlobHash?: string;
    isAI: boolean;
    modelId?: string;
    canMessage: boolean;
    isConnected: boolean;
    status?: 'owner' | 'connected' | 'disconnected';
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
 * ContactsPlan - Pure business logic for contact operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - nodeOneCore: Platform-specific ONE.core instance
 */
export declare class ContactsPlan {
    static get planName(): string;
    static get description(): string;
    static get version(): string;
    static get planId(): SHA256IdHash<any>;
    private nodeOneCore;
    private storyFactory?;
    constructor(nodeOneCore: any, storyFactory?: StoryFactory);
    /**
     * Set StoryFactory after initialization (for gradual adoption)
     */
    setStoryFactory(factory: StoryFactory): void;
    /**
     * Get current instance version hash for Story/Assembly tracking
     */
    private getCurrentInstanceVersion;
    /**
     * Invalidate the contacts cache (deprecated - no-op)
     */
    invalidateCache(): void;
    /**
     * Helper to run an async operation with timeout
     */
    private withTimeout;
    /**
     * Get all contacts
     */
    getContacts(): Promise<GetContactsResponse>;
    /**
     * Get all contacts with trust information using trust.core
     * Platform-agnostic: Uses TrustModel only, no transport dependencies
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
     * Creates Person, Profile, and Someone objects
     *
     * ASSEMBLY TRIGGER: Case #5 - Store Someone/Profile (Identity Domain)
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
     * Internal implementation of addContact (wrapped by Story+Assembly recording)
     */
    private addContactInternal;
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
     *
     * ASSEMBLY TRIGGER: Case #5 - Create a group (Identity Domain)
     */
    createGroup(name: string, memberIds?: string[]): Promise<{
        success: boolean;
        group?: any;
        error?: string;
    }>;
    /**
     * Internal implementation of createGroup (wrapped by Story+Assembly recording)
     */
    private createGroupInternal;
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
    /**
     * Get all profiles for a Someone contact
     *
     * Uses LeuteModel.getSomeone() to find the Someone, then
     * SomeoneModel.profiles() to get all ProfileModel instances.
     */
    getProfilesForSomeone(request: {
        personId: string;
    }): Promise<{
        success: boolean;
        profiles?: any[];
        error?: string;
    }>;
    /**
     * Get profile for a contact (main profile)
     */
    getProfile(request: {
        personId: string;
    }): Promise<{
        success: boolean;
        profile?: any;
        error?: string;
    }>;
    /**
     * Update profile for a contact
     */
    updateProfile(request: {
        personId: string;
        name?: string;
        email?: string;
        phone?: string;
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        website?: string;
        birthday?: string;
        jobTitle?: string;
        company?: string;
        notes?: string;
        avatarBlobHash?: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Upload avatar image and return blob hash
     */
    uploadAvatar(request: {
        dataUrl: string;
    }): Promise<{
        success: boolean;
        blobHash?: string;
        error?: string;
    }>;
    /**
     * Get avatar as data URL from blob hash
     */
    getAvatarDataUrl(request: {
        blobHash: string;
    }): Promise<{
        success: boolean;
        dataUrl?: string;
        error?: string;
    }>;
    /**
     * Get lama avatar config for a person (stub - not yet implemented)
     */
    getLamaAvatarConfig(request: {
        personId: string;
        name?: string;
    }): Promise<{
        success: boolean;
        lamaConfig?: any;
        error?: string;
    }>;
    /**
     * Save lama avatar config for a person (stub - not yet implemented)
     */
    saveLamaAvatarConfig(request: {
        personId: string;
        name?: string;
        lamaConfig: any;
    }): Promise<{
        success: boolean;
        generation?: number;
        error?: string;
    }>;
}
export {};
//# sourceMappingURL=ContactsPlan.d.ts.map