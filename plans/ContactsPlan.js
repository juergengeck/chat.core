/**
 * Contacts Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for contact management operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api architecture.
 */
import { storeVersionedObject, getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { storeUnversionedObject, getObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { ensureIdHash } from '@refinio/one.core/lib/util/type-checks.js';
/**
 * ContactsPlan - Pure business logic for contact operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - nodeOneCore: Platform-specific ONE.core instance
 */
export class ContactsPlan {
    nodeOneCore;
    constructor(nodeOneCore) {
        this.nodeOneCore = nodeOneCore;
    }
    /**
     * Get all contacts
     */
    async getContacts() {
        try {
            if (!this.nodeOneCore.leuteModel) {
                return { success: false, error: 'Leute model not initialized' };
            }
            // Get human contacts - these are Someone objects that need to be transformed
            const someoneObjects = await this.nodeOneCore.leuteModel.others();
            const allContacts = [];
            // Track processed Person IDs to skip duplicates
            const processedPersonIds = new Set();
            // Transform Someone objects to plain serializable objects
            for (const someone of someoneObjects) {
                const personId = await someone.mainIdentity();
                if (!personId)
                    continue;
                // Skip if we've already processed this Person (duplicate Someone object)
                if (processedPersonIds.has(personId)) {
                    continue;
                }
                processedPersonIds.add(personId);
                // Get profile to extract display name from PersonName
                const profile = await someone.mainProfile();
                let displayName = '';
                if (profile?.personDescriptions && Array.isArray(profile.personDescriptions)) {
                    const nameDesc = profile.personDescriptions.find((d) => d.$type$ === 'PersonName');
                    if (nameDesc && 'name' in nameDesc) {
                        displayName = nameDesc.name;
                    }
                }
                // Check if this is an AI contact first (for fallback display name)
                let isAI = false;
                let modelId;
                if (this.nodeOneCore.aiAssistantModel?.llmObjectManager) {
                    isAI = this.nodeOneCore.aiAssistantModel.llmObjectManager.isLLMPerson(personId);
                    // If this is an AI, get the model ID
                    if (isAI && this.nodeOneCore.aiAssistantModel) {
                        modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(personId);
                    }
                }
                // If no PersonName found, get name or email from Person object
                if (!displayName) {
                    const result = await getObjectByIdHash(personId);
                    const person = result?.obj;
                    if (person && person.$type$ === 'Person') {
                        // Try name first (AI contacts have this), then fall back to email
                        displayName = person.name || person.email;
                        // For AI contacts with email but no name, try to get model display name
                        if (!displayName && person.email?.endsWith('@ai.local')) {
                            // Extract modelId from email (format: "model_id@ai.local")
                            const emailModelId = person.email.replace('@ai.local', '').replace(/_/g, ':');
                            if (this.nodeOneCore.aiAssistantModel?.llmObjectManager) {
                                try {
                                    const llmObject = await this.nodeOneCore.aiAssistantModel.llmObjectManager.getByModelId(emailModelId);
                                    if (llmObject?.name) {
                                        displayName = llmObject.name;
                                    }
                                }
                                catch (err) {
                                    // LLM object lookup failed, continue to fallback
                                }
                            }
                            // Still no name? Use the modelId itself (better than person ID)
                            if (!displayName) {
                                displayName = emailModelId;
                            }
                        }
                    }
                    // Final fallback for non-AI contacts or AI without email
                    if (!displayName) {
                        if (isAI && modelId) {
                            // Use model ID if we have it from the cache
                            displayName = modelId;
                        }
                        else {
                            // Last resort: use truncated person ID (silent fallback)
                            displayName = `Contact ${String(personId).substring(0, 8)}`;
                        }
                    }
                }
                allContacts.push({
                    id: personId,
                    personId: personId,
                    name: displayName,
                    isAI: isAI,
                    modelId: modelId,
                    canMessage: true,
                    isConnected: isAI // AI is always "connected"
                });
            }
            return {
                success: true,
                contacts: allContacts
            };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to get contacts:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get all contacts with trust information
     */
    async getContactsWithTrust() {
        try {
            if (!this.nodeOneCore.leuteModel) {
                return { success: false, error: 'Leute model not initialized' };
            }
            const contacts = await this.nodeOneCore.leuteModel.others();
            // Enhance with trust information
            const contactsWithTrust = await Promise.all(contacts.map(async (contact) => {
                // Get trust level from trust manager
                const trustLevel = await this.nodeOneCore.quicTransport?.trustManager?.getContactTrustLevel(contact.personId) || 'unknown';
                // Check if connected via QUIC
                const isConnected = this.nodeOneCore.quicTransport?.peers?.has(contact.personId) || false;
                // Check communication permissions
                const canMessage = await this.nodeOneCore.quicTransport?.trustManager?.canCommunicateWith(contact.personId, 'message') || false;
                const canSync = await this.nodeOneCore.quicTransport?.trustManager?.canCommunicateWith(contact.personId, 'sync') || false;
                return {
                    ...contact,
                    id: contact.personId,
                    name: contact.name || 'Unknown',
                    isAI: false, // TODO: Check if AI
                    canMessage,
                    isConnected,
                    trustLevel,
                    canSync,
                    discoverySource: 'quic-vc-discovery',
                    discoveredAt: Date.now() - Math.random() * 86400000 // TODO: Get actual timestamp
                };
            }));
            return { success: true, contacts: contactsWithTrust };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to get contacts with trust:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get pending contacts (contacts awaiting acceptance)
     */
    async getPendingContacts() {
        try {
            if (!this.nodeOneCore.quicTransport?.leuteModel) {
                return { success: true, pendingContacts: [] };
            }
            const pendingContacts = this.nodeOneCore.quicTransport.leuteModel.getPendingContacts();
            return { success: true, pendingContacts };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to get pending contacts:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get specific pending contact details
     */
    async getPendingContact(pendingId) {
        try {
            if (!this.nodeOneCore.quicTransport?.leuteModel) {
                return { success: false, error: 'Contact manager not initialized' };
            }
            const pendingContact = this.nodeOneCore.quicTransport.leuteModel.getPendingContact(pendingId);
            if (!pendingContact) {
                return { success: false, error: 'Pending contact not found' };
            }
            return { success: true, pendingContact };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to get pending contact:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Accept a pending contact (update trust level)
     */
    async acceptContact(personId, options = {}) {
        try {
            if (!this.nodeOneCore.quicTransport?.trustManager) {
                return { success: false, error: 'Trust manager not initialized' };
            }
            const result = await this.nodeOneCore.quicTransport.trustManager.acceptContact(personId, options);
            return result;
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to accept contact:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Block a contact
     */
    async blockContact(personId, reason) {
        try {
            if (!this.nodeOneCore.quicTransport?.trustManager) {
                return { success: false, error: 'Trust manager not initialized' };
            }
            const result = await this.nodeOneCore.quicTransport.trustManager.blockContact(personId, reason);
            return result;
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to block contact:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Reject a pending contact
     */
    async rejectContact(pendingId, reason) {
        try {
            if (!this.nodeOneCore.quicTransport?.leuteModel) {
                return { success: false, error: 'Contact manager not initialized' };
            }
            const result = await this.nodeOneCore.quicTransport.leuteModel.rejectContact(pendingId, reason);
            return result;
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to reject contact:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Add a new contact
     */
    async addContact(personInfo) {
        try {
            if (!this.nodeOneCore.leuteModel) {
                return { success: false, error: 'Leute model not initialized' };
            }
            // Create Person object with proper type
            const personData = {
                $type$: 'Person',
                email: personInfo.email,
                name: personInfo.name
            };
            const personResult = await storeVersionedObject(personData);
            const personIdHash = ensureIdHash(typeof personResult === 'object' && personResult?.idHash ? personResult.idHash : personResult);
            // Get my identity
            const myId = await this.nodeOneCore.leuteModel.myMainIdentity();
            // Store PersonName object first (personDescription contains hash-links)
            const personNameObj = {
                $type$: 'PersonName',
                name: personInfo.name
            };
            const personNameResult = await storeUnversionedObject(personNameObj);
            const personNameHash = personNameResult.hash;
            // Create Profile object directly (following AIContactManager pattern)
            const profileObj = {
                $type$: 'Profile',
                profileId: `contact-${personInfo.email.replace(/[^a-zA-Z0-9]/g, '_')}`,
                personId: personIdHash,
                owner: myId,
                personDescription: [personNameHash],
                communicationEndpoint: []
            };
            const profileResult = await storeVersionedObject(profileObj);
            const profileIdHash = ensureIdHash(typeof profileResult === 'object' && profileResult?.idHash ? profileResult.idHash : profileResult);
            // Create Someone object with identities Map
            const someoneData = {
                $type$: 'Someone',
                someoneId: personInfo.email,
                mainProfile: profileIdHash,
                identities: new Map([[personIdHash, new Set([profileIdHash])]])
            };
            const someoneResult = await storeVersionedObject(someoneData);
            const someoneIdHash = ensureIdHash(typeof someoneResult === 'object' && someoneResult?.idHash ? someoneResult.idHash : someoneResult);
            // Add to LeuteModel using addProfile
            await this.nodeOneCore.leuteModel.addProfile(profileIdHash);
            return {
                success: true,
                contact: {
                    personHash: personIdHash,
                    profileHash: profileIdHash,
                    someoneHash: someoneIdHash,
                    person: personData
                }
            };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to add contact:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Remove a contact
     */
    async removeContact(contactId) {
        try {
            if (!this.nodeOneCore.leuteModel) {
                return { success: false, error: 'Leute model not initialized' };
            }
            await this.nodeOneCore.leuteModel.removeSomeoneElse(contactId);
            return { success: true };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to remove contact:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Revoke contact's VC
     */
    async revokeContactVC(personId) {
        try {
            if (!this.nodeOneCore.quicTransport?.leuteModel) {
                return { success: false, error: 'Contact manager not initialized' };
            }
            await this.nodeOneCore.quicTransport.leuteModel.revokeContactVC(personId);
            return { success: true };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to revoke contact VC:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    // ===== Group Management (using core Group objects) =====
    /**
     * Get all groups using core Group objects
     */
    async getGroups() {
        try {
            if (!this.nodeOneCore.leuteModel) {
                return { success: false, error: 'Leute model not initialized' };
            }
            // Get all groups via LeuteModel (returns GroupModel[] - we extract Group data)
            const groupModels = await this.nodeOneCore.leuteModel.groups();
            const groupList = [];
            for (const groupModel of groupModels) {
                // Extract core Group data (avoid GroupModel abstractions)
                const groupData = {
                    id: groupModel.groupIdHash, // Core Group ID hash
                    name: groupModel.internalGroupName,
                    memberCount: groupModel.persons?.length || 0
                };
                groupList.push(groupData);
            }
            return { success: true, groups: groupList };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to get groups:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Create a new group using core Group object
     */
    async createGroup(name, memberIds) {
        try {
            // Create core Group object directly
            // Create HashGroup with members first (HashGroup.person is a Set in new one.core)
            const memberArray = memberIds ? memberIds.map(id => ensureIdHash(id)) : [];
            const hashGroupObj = {
                $type$: 'HashGroup',
                person: new Set(memberArray)
            };
            const hashGroup = await storeUnversionedObject(hashGroupObj);
            // Create Group referencing HashGroup
            const group = {
                $type$: 'Group',
                name: name || `group-${Date.now()}`,
                hashGroup: hashGroup.hash
            };
            // Store using one.core API
            const result = await storeVersionedObject(group);
            return {
                success: true,
                group: {
                    id: result.idHash,
                    name: group.name,
                    memberCount: memberArray.length
                }
            };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to create group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Add contacts to a group (core Group pattern)
     */
    async addContactsToGroup(groupId, contactIds) {
        try {
            // Get current Group object
            const groupIdHash = ensureIdHash(groupId);
            const groupResult = await getObjectByIdHash(groupIdHash);
            const group = groupResult.obj;
            // Resolve HashGroup to get current members
            const hashGroupResult = await getObject(group.hashGroup);
            const members = new Set(hashGroupResult.person);
            // Add new members
            for (const contactId of contactIds) {
                const personIdHash = ensureIdHash(contactId);
                members.add(personIdHash);
            }
            // Create new HashGroup with updated members
            const newHashGroup = await storeUnversionedObject({
                $type$: 'HashGroup',
                person: members
            });
            // Update Group to reference new HashGroup
            await storeVersionedObject({
                $type$: 'Group',
                $versionHash$: group.$versionHash$,
                name: group.name,
                hashGroup: newHashGroup.hash
            });
            return { success: true };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to add contacts to group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Remove contacts from a group (core Group pattern)
     */
    async removeContactsFromGroup(groupId, contactIds) {
        try {
            // Get current Group object
            const groupIdHash = ensureIdHash(groupId);
            const groupResult = await getObjectByIdHash(groupIdHash);
            const group = groupResult.obj;
            // Resolve HashGroup to get current members
            const hashGroupResult = await getObject(group.hashGroup);
            const members = new Set(hashGroupResult.person);
            // Remove members
            for (const contactId of contactIds) {
                const personIdHash = ensureIdHash(contactId);
                members.delete(personIdHash);
            }
            // Create new HashGroup with updated members
            const newHashGroup = await storeUnversionedObject({
                $type$: 'HashGroup',
                person: members
            });
            // Update Group to reference new HashGroup
            await storeVersionedObject({
                $type$: 'Group',
                $versionHash$: group.$versionHash$,
                name: group.name,
                hashGroup: newHashGroup.hash
            });
            return { success: true };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to remove contacts from group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get group members (core Group pattern)
     */
    async getGroupMembers(groupId) {
        try {
            if (!this.nodeOneCore.leuteModel) {
                return { success: false, error: 'Leute model not initialized' };
            }
            // Get Group object
            const groupIdHash = ensureIdHash(groupId);
            const result = await getObjectByIdHash(groupIdHash);
            const group = result.obj;
            // Resolve HashGroup to get members
            const hashGroupResult = await getObject(group.hashGroup);
            const memberIds = hashGroupResult.person;
            // Get member details
            const members = [];
            const someoneObjects = await this.nodeOneCore.leuteModel.others();
            for (const personIdHash of memberIds) {
                const someone = someoneObjects.find((s) => s.mainIdentity() === personIdHash);
                if (someone) {
                    const profile = await someone.mainProfile();
                    const name = profile?.personDescriptions?.find((d) => d.$type$ === 'PersonName')?.name || 'Unknown';
                    members.push({
                        id: personIdHash,
                        name
                    });
                }
            }
            return { success: true, members };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to get group members:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Delete a group - NOTE: Groups cannot be truly deleted in ONE.core
     * This marks the group as deleted by removing all members
     */
    async deleteGroup(groupId) {
        try {
            // Get Group object
            const groupIdHash = ensureIdHash(groupId);
            const result = await getObjectByIdHash(groupIdHash);
            const group = result.obj;
            // Create empty HashGroup (soft delete)
            const emptyHashGroup = await storeUnversionedObject({
                $type$: 'HashGroup',
                person: new Set()
            });
            // Update Group to reference empty HashGroup
            await storeVersionedObject({
                $type$: 'Group',
                $versionHash$: group.$versionHash$,
                name: group.name,
                hashGroup: emptyHashGroup.hash
            });
            return { success: true };
        }
        catch (error) {
            console.error('[ContactsPlan] Failed to delete group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
//# sourceMappingURL=ContactsPlan.js.map