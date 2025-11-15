/**
 * Contact Acceptance Service
 *
 * Platform-agnostic contact acceptance flow management.
 * Manages the two-phase contact acceptance flow:
 * 1. Receive and store pending contact information
 * 2. User reviews and accepts/rejects
 * 3. Generate dedicated VC for accepted contacts
 *
 * Transport layer is injected via constructor (dependency injection pattern).
 */
import { EventEmitter } from 'events';
interface ContactAcceptanceOptions {
    nickname?: string;
    groups?: string[];
    tags?: string[];
    notes?: string;
    canMessage?: boolean;
    canCall?: boolean;
    canShareFiles?: boolean;
    canSeePresence?: boolean;
    customPermissions?: Record<string, any>;
}
/**
 * Transport abstraction for platform independence
 */
export interface ContactTransport {
    sendToPeer(peerId: any, message: any, messageType: string): Promise<void>;
}
export declare class ContactAcceptanceService extends EventEmitter {
    nodeOneCore: any;
    private transport?;
    privateSignKey: any;
    Person: any;
    ProfileModel: any;
    OneInstanceEndpoint: any;
    verify: any;
    pendingContacts: Map<string, any>;
    acceptedContacts: Map<string, any>;
    contactVCs: Map<string, any>;
    constructor(nodeOneCore: any, transport?: ContactTransport);
    /**
     * Add a contact to pending review (from VC exchange)
     */
    addPendingContact(credential: any, peerId: any, connectionInfo: any): Promise<any>;
    /**
     * Get all pending contacts for UI display
     */
    getPendingContacts(): any;
    /**
     * Get specific pending contact details
     */
    getPendingContact(pendingId: any): any;
    /**
     * Accept a pending contact and create dedicated VC
     */
    acceptContact(pendingId: string, options?: ContactAcceptanceOptions): Promise<any>;
    /**
     * Reject a pending contact
     */
    rejectContact(pendingId: string, reason?: string): Promise<any>;
    /**
     * Create a dedicated VC for an accepted contact
     */
    createDedicatedVC(pendingContact: any, options?: ContactAcceptanceOptions): Promise<any>;
    /**
     * Create ONE.core contact objects
     */
    createOneContact(pendingContact: any, dedicatedVC: any): Promise<any>;
    /**
     * Send dedicated VC to the contact (uses injected transport)
     */
    sendDedicatedVC(peerId: any, dedicatedVC: any): Promise<any>;
    /**
     * Send rejection notice to peer (uses injected transport)
     */
    sendRejectionNotice(peerId: any, reason: any): Promise<any>;
    /**
     * Handle received dedicated VC from a contact
     */
    handleReceivedDedicatedVC(dedicatedVC: any, peerId: any): Promise<any>;
    /**
     * Get contact's dedicated VC
     */
    getContactVC(personId: any): any;
    /**
     * Check if a contact is mutually accepted
     */
    isMutuallyAccepted(personId: any): any;
    /**
     * Revoke a contact's VC
     */
    revokeContactVC(personId: any): Promise<any>;
}
export default ContactAcceptanceService;
//# sourceMappingURL=ContactAcceptanceService.d.ts.map