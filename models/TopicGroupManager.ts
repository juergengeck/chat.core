/**
 * Topic Group Manager (Platform-Agnostic)
 * Manages group creation for topics with proper participants
 *
 * This is pure business logic that works on both Node.js and browser platforms.
 * Platform-specific concerns are handled via dependency injection.
 */

import { getAllEntries } from '@refinio/one.core/lib/reverse-map-query.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';

/**
 * Storage functions for TopicGroupManager (to avoid module duplication in Vite worker)
 */
export interface TopicGroupManagerStorageDeps {
  storeVersionedObject: (obj: any) => Promise<any>;
  storeUnversionedObject: (obj: any) => Promise<any>;
  getObjectByIdHash: (idHash: SHA256IdHash<any>) => Promise<any>;
  getObject: (hash: SHA256Hash<any>) => Promise<any>;
  getAllOfType: (type: string) => Promise<any[]>;
  createAccess: (accessRequests: any[]) => Promise<any>;
  calculateIdHashOfObj: (obj: any) => Promise<SHA256IdHash<any>>;
  calculateHashOfObj: (obj: any) => Promise<SHA256Hash<any>>;
}

/**
 * Minimal interface for ONE.core instance
 * Works for both NodeOneCore and WorkerOneCore
 */
export interface OneCoreInstance {
  ownerId: SHA256IdHash<Person>;
  channelManager: ChannelManager;
  topicModel: TopicModel;
  leuteModel: LeuteModel;
  aiAssistantModel?: any; // AIAssistantHandler
}

export class TopicGroupManager {
  private oneCore: OneCoreInstance;
  private conversationGroups: Map<string, SHA256IdHash<any>>;
  private storageDeps: TopicGroupManagerStorageDeps;
  private allowedGroups: Set<SHA256IdHash<any>>; // Groups we created and allow sharing

  constructor(oneCore: OneCoreInstance, storageDeps: TopicGroupManagerStorageDeps) {
    this.oneCore = oneCore;
    this.storageDeps = storageDeps;
    this.conversationGroups = new Map(); // topicId -> groupIdHash
    this.allowedGroups = new Set(); // Groups we allow to share via CHUM
  }

  /**
   * Create an outbound objectFilter for CHUM sync (what we SEND to peers)
   * Simple allowlist: only share Groups we created
   *
   * @returns ObjectFilter function for use in ConnectionsModel config
   */
  createObjectFilter(): (hash: SHA256Hash<any> | SHA256IdHash<any>, type: string) => Promise<boolean> {
    return async (hash: SHA256Hash<any> | SHA256IdHash<any>, type: string): Promise<boolean> => {
      if (type === 'Group') {
        const allowed = this.allowedGroups.has(hash as SHA256IdHash<any>);
        console.log(`[TopicGroupManager] objectFilter: ${allowed ? '✅ Allow' : '❌ Block'} Group ${String(hash).substring(0, 8)} (outbound)`);
        return allowed;
      }

      // Allow all other object types (Access/IdAccess handled by ONE.core defaults)
      return true;
    };
  }

  /**
   * Create an inbound importFilter for CHUM sync (what we ACCEPT from peers)
   * Validates Groups have cryptographic certificates from trusted people
   *
   * @returns ImportFilter function for use in ConnectionsModel config
   */
  createImportFilter(): (hash: SHA256Hash<any> | SHA256IdHash<any>, type: string) => Promise<boolean> {
    return async (hash: SHA256Hash<any> | SHA256IdHash<any>, type: string): Promise<boolean> => {
      if (type === 'Group') {
        try {
          console.log(`[TopicGroupManager] importFilter: Validating Group certificate for ${String(hash).substring(0, 8)}`);

          // Get list of people we trust (ourselves + people we've paired with)
          const knownPeople = await this.oneCore.leuteModel.others();
          const myId = await this.oneCore.leuteModel.myMainIdentity();
          const trustedPeople = [myId, ...knownPeople];

          // Check if this Group is affirmed by any trusted person using the certificate system
          const trust = this.oneCore.leuteModel.trust;

          // Get all affirmation certificates for this Group
          const affirmedBy = await trust.affirmedBy(hash as SHA256Hash<any>);

          if (affirmedBy.length === 0) {
            console.log(`[TopicGroupManager] ❌ No AffirmationCertificate found for Group ${String(hash).substring(0, 8)}`);
            return false;
          }

          // Check if any of the affirmers are trusted
          for (const affirmerId of affirmedBy) {
            if (trustedPeople.includes(affirmerId)) {
              // Verify the certificate is actually valid (signature checks, etc)
              const isAffirmed = await trust.isAffirmedBy(hash as SHA256Hash<any>, affirmerId);
              if (isAffirmed) {
                console.log(`[TopicGroupManager] ✅ Valid AffirmationCertificate for Group ${String(hash).substring(0, 8)} by trusted person ${String(affirmerId).substring(0, 8)}`);
                return true;
              }
            } else {
              console.log(`[TopicGroupManager] ⚠️  Certificate from unknown person ${String(affirmerId).substring(0, 8)}`);
            }
          }

          console.log(`[TopicGroupManager] ❌ No valid trusted certificate for Group ${String(hash).substring(0, 8)}`);
          return false;
        } catch (error) {
          console.error(`[TopicGroupManager] Error validating Group certificate:`, error);
          return false;
        }
      }

      // Block Access/IdAccess by default (security - these control permissions)
      if (type === 'Access' || type === 'IdAccess') {
        console.log(`[TopicGroupManager] importFilter: ❌ Block ${type} (security policy)`);
        return false;
      }

      // Allow all other object types
      return true;
    };
  }

  /**
   * Check if a conversation has a group
   */
  hasConversationGroup(conversationId: string): boolean {
    return this.conversationGroups.has(conversationId);
  }

  /**
   * Check if a conversation is P2P (2 participants)
   */
  isP2PConversation(conversationId: any): any {
    // Check if it's the P2P format: personId1<->personId2
    const p2pRegex = /^([0-9a-f]{64})<->([0-9a-f]{64})$/
    return p2pRegex.test(conversationId)
  }

  /**
   * Create or get a conversation group for a topic
   * This group includes: browser owner, node owner, and AI assistant
   */
  async getOrCreateConversationGroup(topicId: any, aiPersonId = null): Promise<unknown> {
    // Check if we already have a group for this topic
    if (this.conversationGroups.has(topicId)) {
      return this.conversationGroups.get(topicId);
    }

    console.log(`[TopicGroupManager] Creating conversation group for topic: ${topicId}`);

    // CRITICAL: Do not create groups if we don't have an owner ID yet
    if (!this.oneCore.ownerId) {
      console.error('[TopicGroupManager] Cannot create group - nodeOneCore.ownerId is not set!');
      throw new Error('Cannot create group without owner ID');
    }

    try {
      // Get all participants
      const participants: any = await this.getDefaultParticipants(aiPersonId);

      // Create a Group object with these members
      const groupName = `conversation-${topicId}`;

      // 1. Create HashGroup with members
      const hashGroup = {
        $type$: 'HashGroup' as const,
        person: new Set(participants)
      };
      console.log(`[TopicGroupManager] 🔍 About to store HashGroup with ${participants.length} members`);
      const storedHashGroup: any = await this.storageDeps.storeUnversionedObject(hashGroup as any);
      console.log(`[TopicGroupManager] 🔍 storeUnversionedObject returned:`, JSON.stringify(storedHashGroup, null, 2));

      if (!storedHashGroup || !storedHashGroup.hash) {
        throw new Error(`[TopicGroupManager] storeUnversionedObject failed for HashGroup: ${JSON.stringify(storedHashGroup)}`);
      }

      // 2. Create Group referencing the HashGroup
      const group = {
        $type$: 'Group' as const,
        name: groupName,
        hashGroup: storedHashGroup.hash
      };

      console.log(`[TopicGroupManager] 🔍 About to store Group:`, JSON.stringify(group, null, 2));

      // Store the group
      const storedGroup: any = await this.storageDeps.storeVersionedObject(group as any);

      if (!storedGroup || !storedGroup.idHash) {
        throw new Error(`[TopicGroupManager] storeVersionedObject failed for Group: ${JSON.stringify(storedGroup)}`);
      }

      const groupIdHash = storedGroup.idHash;
      const hashGroupHash = storedHashGroup.hash;

      console.log(`[TopicGroupManager] Created group ${groupName} with ${participants.length} persons, hashGroup: ${String(hashGroupHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] Persons:`, participants.map((p: any) => String(p).substring(0, 8)).join(', '));

      // Cache the group and add HashGroup to allowed list (for CHUM sync)
      this.conversationGroups.set(topicId, groupIdHash);
      this.allowedGroups.add(hashGroupHash);
      console.log(`[TopicGroupManager] Added HashGroup ${String(hashGroupHash).substring(0, 8)} to allowed groups`);

      // IMPORTANT: Do NOT grant any access to the Group object itself
      // This would cause CHUM to try to sync the Group object, which is rejected
      // Groups stay local - only IdAccess objects referencing them are shared
      // The group will be used in IdAccess objects to grant access to channels
      console.log(`[TopicGroupManager] Created local group ${String(groupIdHash).substring(0, 8)} - will use for channel access control`);

      return groupIdHash;
    } catch (error) {
      console.error('[TopicGroupManager] Failed to create conversation group:', error);
      throw error;
    }
  }

  /**
   * Get default participants for a conversation
   * This returns the minimal set - actual conversations will add more participants
   */
  async getDefaultParticipants(aiPersonId = null): Promise<unknown> {
    const participants = [];

    // 1. Node owner (always included - this is the local user)
    if (this.oneCore.ownerId) {
      participants.push(this.oneCore.ownerId);
      console.log('[TopicGroupManager] Added node owner:', this.oneCore.ownerId?.substring(0, 8));
    }

    // 2. Specific AI assistant if provided
    if (aiPersonId) {
      participants.push(aiPersonId);
      console.log('[TopicGroupManager] Added specified AI assistant:', String(aiPersonId).substring(0, 8));
    }

    // Note: This is just the default/minimal set
    // Actual conversations will add specific participants via addParticipantsToGroup

    return participants;
  }

  /**
   * Add participants to a conversation group
   * @deprecated Use addParticipantsToTopic() instead
   */
  async addParticipantsToGroup(topicId: any, participantIds: any): Promise<any> {
    console.log(`[TopicGroupManager] addParticipantsToGroup() called - delegating to addParticipantsToTopic()`);
    return this.addParticipantsToTopic(topicId, participantIds);
  }

  /**
   * Get default AI person ID
   */
  getDefaultAIPersonId(): any {
    // Get from AI assistant model using refactored architecture
    if (this.oneCore.aiAssistantModel) {
      const defaultModel = this.oneCore.aiAssistantModel.getDefaultModel();
      if (defaultModel) {
        const contactManager = this.oneCore.aiAssistantModel.getContactManager();
        return contactManager.getPersonIdForModel(defaultModel.id);
      }
    }

    return null;
  }

  /**
   * Add a participant to relevant conversation groups
   * This is called when a CHUM connection is established
   * For group chats: adds them to groups where they should be a member
   * For P2P: ensures the P2P conversation structure exists
   * @param {string} personId - The person ID to add to relevant groups
   */
  async addParticipantToRelevantGroups(personId: any): Promise<any> {
    console.log(`[TopicGroupManager] Adding participant ${String(personId).substring(0, 8)} to relevant conversation groups`);

    // For group chats, we need to:
    // 1. Find all group conversations where this person should be a member
    // 2. Add them to those groups
    // 3. Let them know they need to create their own channels

    // For now, we'll handle P2P conversations
    // Group chat membership should be managed explicitly when creating the group

    // Generate the P2P topic ID for this participant
    const sortedIds = [this.oneCore.ownerId, personId].sort();
    const p2pTopicId = `${sortedIds[0]}<->${sortedIds[1]}`;

    // Check if we have a P2P conversation with this peer
    const groupIdHash = this.conversationGroups.get(p2pTopicId);

    if (groupIdHash) {
      try {
        console.log(`[TopicGroupManager] P2P conversation exists with ${String(personId).substring(0, 8)}: ${p2pTopicId}`);
        // The group already exists and both parties should be members
        // Just ensure access is granted
        await this.ensureGroupAccess(groupIdHash, personId);
      } catch (error) {
        console.warn(`[TopicGroupManager] Failed to ensure P2P group access:`, (error as Error).message);
      }
    }

    // For group chats: Peers need to be explicitly added when the group is created
    // They will receive the Group object through CHUM sync if they're members
    // They need to create their own channels when they detect the group

    console.log(`[TopicGroupManager] Completed processing groups for participant`);
  }
  
  /**
   * Ensure a participant has access to a group they're a member of
   */
  async ensureGroupAccess(groupIdHash: any, personId: any): Promise<any> {
    // IMPORTANT: Do NOT grant person-based access to the Group object itself
    // This would cause CHUM to try to sync the Group object, which is rejected
    // Groups stay local - only IdAccess objects referencing them are shared (for channel access)
    console.log(`[TopicGroupManager] Note: Groups are local objects, not syncing group ${String(groupIdHash).substring(0, 8)} to ${String(personId).substring(0, 8)}`);
  }

  /**
   * Add a participant to a specific conversation group
   * @param {string} topicId - The topic ID
   * @param {string} groupIdHash - The group's ID hash
   * @param {string} personId - The person ID to add
   */
  async addParticipantToGroup(topicId: any, groupIdHash: any, personId: any): Promise<any> {
    console.log(`[TopicGroupManager] Adding ${String(personId).substring(0, 8)} to group for topic ${topicId}`);

    try {
      // 1. Load existing Group
      const result: any = await this.storageDeps.getObjectByIdHash(groupIdHash);
      const existingGroup: any = result.obj;

      if (!existingGroup) {
        throw new Error(`Group ${groupIdHash} not found`);
      }

      // 2. Load existing HashGroup to get current members
      const hashGroupResult: any = await this.storageDeps.getObject(existingGroup.hashGroup);
      const currentMembers: any = hashGroupResult.members || [];

      // Check if the person is already in the group
      if (currentMembers.includes(personId)) {
        console.log(`[TopicGroupManager] ${String(personId).substring(0, 8)} is already in the group`);
        return;
      }

      // 3. Create new HashGroup with added member
      const newHashGroup = {
        $type$: 'HashGroup' as const,
        person: new Set([...currentMembers, personId])
      };
      const storedHashGroup: any = await this.storageDeps.storeUnversionedObject(newHashGroup as any);

      // 4. Create new Group version pointing to new HashGroup
      const updatedGroup = {
        $type$: 'Group' as const,
        $versionHash$: existingGroup.$versionHash$,  // Link to previous version
        name: existingGroup.name,
        hashGroup: storedHashGroup.hash
      };

      // Store the updated group (this creates a new version)
      const storedGroup: any = await this.storageDeps.storeVersionedObject(updatedGroup as any);
      const newGroupIdHash = storedGroup.idHash;

      // Update our cache
      this.conversationGroups.set(topicId, newGroupIdHash);

      console.log(`[TopicGroupManager] Updated group for topic ${topicId} with new member`);
      console.log(`[TopicGroupManager] New group members:`, [...currentMembers, personId].map(p => String(p).substring(0, 8)).join(', '));

      // IMPORTANT: Do NOT grant person-based access to the Group object itself
      // This would cause CHUM to try to sync the Group object, which is rejected
      // Groups stay local - only IdAccess objects referencing them are shared

      // Create a channel for the participant in this topic
      if (this.oneCore.channelManager) {
        await this.oneCore.channelManager.createChannel(topicId, personId);

        // Grant the group access to the participant's channel
        const channelHash: any = await this.storageDeps.calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: topicId,
          owner: personId
        });

        await this.storageDeps.createAccess([{
          id: channelHash,
          person: [],
          group: [newGroupIdHash],
          mode: SET_ACCESS_MODE.ADD
        }]);

        console.log(`[TopicGroupManager] Created channel and granted group access for ${String(personId).substring(0, 8)}`);
      }

      // Update the topic to use the new group
      if (this.oneCore.topicModel) {
        const topic: any = await (this.oneCore.topicModel as any).getTopicByName(topicId);
        if (topic) {
          await this.oneCore.topicModel.addGroupToTopic(newGroupIdHash, topic);
          console.log(`[TopicGroupManager] Updated topic ${topicId} with new group`);
        }
      }

    } catch (error) {
      console.error(`[TopicGroupManager] Failed to add participant to group:`, error);
      throw error;
    }
  }

  /**
   * Create a P2P topic following one.leute reference patterns exactly
   * @param {string} topicName - Display name for the topic
   * @param {string} topicId - Topic ID in format: personId1<->personId2
   * @param {Array<string>} participantIds - Array of exactly 2 person IDs
   */
  async createP2PTopic(topicName: any, topicId: any, participantIds: any): Promise<any> {
    console.log(`[TopicGroupManager] Creating P2P topic: ${topicName} (${topicId})`)
    console.log(`[TopicGroupManager] P2P participants:`, participantIds.map((p: any) => String(p).substring(0, 8)).join(', '))

    if (participantIds.length !== 2) {
      throw new Error(`P2P topic requires exactly 2 participants, got ${participantIds.length}`)
    }

    if (!this.oneCore.topicModel) {
      throw new Error('TopicModel not initialized')
    }

    // Use createOneToOneTopic - this creates deterministic topic with proper access
    const [from, to] = participantIds
    const topic: any = await this.oneCore.topicModel.createOneToOneTopic(from, to)

    console.log(`[TopicGroupManager] ✅ P2P topic created: ${topic.id}`)
    console.log(`[TopicGroupManager] ✅ Channel: ${topic.channel?.substring(0, 16)}...`)

    // Verify the topic ID matches our expected format
    if (topic.id !== topicId) {
      console.warn(`[TopicGroupManager] ⚠️  Topic ID mismatch: expected ${topicId}, got ${topic.id}`)
    }

    return topic
  }

  /**
   * Create a topic with the conversation group - compatible with one.leute architecture
   * In one.leute: ONE topic ID, MULTIPLE channels (one per participant)
   * @param {string} topicName - Display name for the topic
   * @param {string} topicId - Unique ID for the topic
   * @param {Array<string>} participantIds - Array of person IDs (humans, AIs, etc) to include
   * @param {boolean} autoAddChumConnections - Whether to automatically add all CHUM connections (default: false)
   */
  async createGroupTopic(topicName: string, topicId: string, participantIds: SHA256IdHash<Person>[] = [], autoAddChumConnections = false): Promise<unknown> {
    console.log(`[TopicGroupManager] 🔍 DEBUG Creating topic: "${topicName}" with ID: "${topicId}"`);
    console.log(`[TopicGroupManager] 🔍 DEBUG Initial participants: ${participantIds.length} persons`);
    console.log(`[TopicGroupManager] 🔍 DEBUG topicId type: ${typeof topicId}, length: ${topicId?.length}`);

    // P2P conversations MUST use createOneToOneTopic directly - no groups
    const isP2P = topicId.includes('<->');
    console.log(`[TopicGroupManager] Is P2P conversation: ${isP2P}`);

    if (isP2P) {
      // P2P conversations should NEVER reach this method
      // They should go directly through TopicModel.createOneToOneTopic
      throw new Error(`P2P conversation ${topicId} should use TopicModel.createOneToOneTopic, not createGroupTopic`);
    }

    // Always include the node owner
    if (!participantIds.includes(this.oneCore.ownerId)) {
      participantIds.unshift(this.oneCore.ownerId);
    }

    // Add CHUM connections for group chats
    if (autoAddChumConnections) {
      const activeChumConnections = (this.oneCore as any).getActiveCHUMConnections();
      for (const chumPersonId of activeChumConnections) {
        if (!participantIds.includes(chumPersonId)) {
          participantIds.push(chumPersonId);
          console.log(`[TopicGroupManager] Added active CHUM connection ${String(chumPersonId).substring(0, 8)}... to group`);
        }
      }
    }

    console.log(`[TopicGroupManager] Final participants: ${participantIds.length} persons`);
    console.log(`[TopicGroupManager] Participant IDs:`, participantIds.map(p => String(p).substring(0, 8)).join(', '));

    // Create the conversation group with all participants
    const groupName = `conversation-${topicId}`;

    // 1. Create HashGroup with members
    const hashGroup = {
      $type$: 'HashGroup' as const,
      person: new Set(participantIds)  // All participants including node owner, AIs, other contacts
    };
    console.log(`[TopicGroupManager] 🔍 About to store HashGroup with ${participantIds.length} members`);
    const storedHashGroup: any = await this.storageDeps.storeUnversionedObject(hashGroup as any);
    console.log(`[TopicGroupManager] 🔍 storeUnversionedObject returned:`, JSON.stringify(storedHashGroup, null, 2));

    if (!storedHashGroup || !storedHashGroup.hash) {
      throw new Error(`[TopicGroupManager] storeUnversionedObject failed for HashGroup: ${JSON.stringify(storedHashGroup)}`);
    }

    // 2. Create Group referencing the HashGroup
    const group = {
      $type$: 'Group' as const,
      name: groupName,
      hashGroup: storedHashGroup.hash
    };

    console.log(`[TopicGroupManager] 🔍 About to store Group:`, JSON.stringify(group, null, 2));

    // Store the group
    const storedGroup: any = await this.storageDeps.storeVersionedObject(group as any);

    if (!storedGroup || !storedGroup.idHash) {
      throw new Error(`[TopicGroupManager] storeVersionedObject failed for Group: ${JSON.stringify(storedGroup)}`);
    }

    const groupIdHash = storedGroup.idHash;
    const hashGroupHash = storedHashGroup.hash;

    console.log(`[TopicGroupManager] Created group ${groupName} with ${participantIds.length} persons, hashGroup: ${String(hashGroupHash).substring(0, 8)}`);
    console.log(`[TopicGroupManager] Persons:`, participantIds.map(p => String(p).substring(0, 8)).join(', '));

    // Cache the group and add HashGroup to allowed list (for CHUM sync)
    this.conversationGroups.set(topicId, groupIdHash);
    this.allowedGroups.add(hashGroupHash);
    console.log(`[TopicGroupManager] Added HashGroup ${String(hashGroupHash).substring(0, 8)} to allowed groups`);

    // Create an AffirmationCertificate for the HashGroup (cryptographic attestation of validity)
    // This creates: License + Certificate + Signature (all unversioned objects)
    const certResult = await this.oneCore.leuteModel.trust.certify(
      'AffirmationCertificate',
      { data: hashGroupHash },
      this.oneCore.ownerId
    );
    console.log(`[TopicGroupManager] ✅ Created AffirmationCertificate ${String(certResult.certificate.hash).substring(0, 8)} for HashGroup ${String(hashGroupHash).substring(0, 8)}`);
    console.log(`[TopicGroupManager] ✅ Signature: ${String(certResult.signature.hash).substring(0, 8)}, License: ${String(certResult.license.hash).substring(0, 8)}`);

    // Grant access to all objects - CHUM will sync based on new access rights
    await this.storageDeps.createAccess([
      {
        id: storedHashGroup.hash,
        person: participantIds,
        group: [],
        mode: SET_ACCESS_MODE.ADD
      },
      {
        id: groupIdHash,
        person: participantIds,
        group: [],
        mode: SET_ACCESS_MODE.ADD
      },
      {
        object: certResult.certificate.hash,
        person: participantIds,
        group: [],
        mode: SET_ACCESS_MODE.ADD
      },
      {
        object: certResult.signature.hash,
        person: participantIds,
        group: [],
        mode: SET_ACCESS_MODE.ADD
      },
      {
        object: certResult.license.hash,
        person: participantIds,
        group: [],
        mode: SET_ACCESS_MODE.ADD
      }
    ]);

    console.log(`[TopicGroupManager] ✅ Access granted to ${participantIds.length} participants`);

    // Create the topic using TopicModel
    if (!this.oneCore.topicModel) {
      throw new Error('TopicModel not initialized');
    }

    // Create the topic (without group - privacy-preserving)
    // Each participant always owns their own channel
    console.log(`[TopicGroupManager] 🔍 DEBUG Calling topicModel.createGroupTopic("${topicName}", "${topicId}", owner)`);
    const topic: any = await this.oneCore.topicModel.createGroupTopic(
      topicName,
      topicId,
      this.oneCore.ownerId
    );
    console.log(`[TopicGroupManager] 🔍 DEBUG Created topic with ID: "${topic.id}", name: "${topic.name}"`);
    console.log(`[TopicGroupManager] 🔍 DEBUG Topic channel hash: ${topic.channel?.substring(0, 16)}...`);

    console.log(`[TopicGroupManager] Created topic ${topicId}:`, {
      topicId: topic.id,
      channelIdHash: topic.channel,
      owner: this.oneCore.ownerId?.substring(0, 8)
    });

    // Share the topic with the group
    await this.oneCore.topicModel.addGroupToTopic(groupIdHash, topic);
    console.log(`[TopicGroupManager] Added group ${String(groupIdHash).substring(0, 8)} access to topic ${topicId}`);

    // Create channels for ALL participants in participantIds
    // participantIds contains all LOCAL participants (owner + AI contacts, etc.)
    // Remote participants will create their own channels when they receive the Group via CHUM
    for (const participantId of participantIds) {
      if (participantId && this.oneCore.channelManager) {
        try {
          // createChannel is idempotent - if channel exists, it's a no-op
          await this.oneCore.channelManager.createChannel(topicId, participantId);
          console.log(`[TopicGroupManager] Created channel for participant ${String(participantId).substring(0, 8)}`);

          // Grant the group access to this participant's channel
          const channelHash: any = await this.storageDeps.calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            id: topicId,
            owner: participantId
          });

          await this.storageDeps.createAccess([{
            id: channelHash,
            person: [],
            group: [groupIdHash],
            mode: SET_ACCESS_MODE.ADD
          }]);

          console.log(`[TopicGroupManager] Granted group access to channel owned by ${String(participantId).substring(0, 8)}`);
        } catch (error) {
          console.warn(`[TopicGroupManager] Channel creation for ${String(participantId).substring(0, 8)} failed:`, (error as Error).message);
        }
      }
    }

    console.log(`[TopicGroupManager] Topic ${topicId} created with group ${String(groupIdHash).substring(0, 8)}`);
    console.log(`[TopicGroupManager] Created channels for all ${participantIds.length} LOCAL participants`);

    // IMPORTANT: Architecture:
    // - ONE topic ID for the conversation
    // - MULTIPLE channels (one per participant) with the SAME topic ID
    // - Each participant writes to their OWN channel ONLY
    // - All participants can READ from all channels (via group access)
    // - participantIds contains LOCAL participants (owner + AI contacts)
    // - Remote humans create their OWN channels when receiving Group via CHUM
    console.log(`[TopicGroupManager] All local participants have channels`);

    return topic;
  }


  /**
   * Add participants to existing topic's group
   */
  async addParticipantsToTopic(topicId: string, participants: SHA256IdHash<Person>[]): Promise<unknown> {
    console.log(`[TopicGroupManager] ========== ADD PARTICIPANTS START ==========`);
    console.log(`[TopicGroupManager] Topic: ${topicId}`);
    console.log(`[TopicGroupManager] Adding participants:`, participants.map((p: any) => String(p).substring(0, 8)));

    let groupIdHash = this.conversationGroups.get(topicId);
    console.log(`[TopicGroupManager] Cache lookup result: ${groupIdHash ? String(groupIdHash).substring(0, 8) : 'NOT FOUND'}`);

    // Handle legacy topics that don't have groups yet
    if (!groupIdHash) {
      console.log(`[TopicGroupManager] No group found for topic ${topicId}, creating one now (legacy topic)`);

      // Get current topic participants if available
      let currentParticipants: any[] = [this.oneCore.ownerId];

      try {
        // Try to get the AI model for this topic
        if (this.oneCore.aiAssistantModel) {
          const modelId = this.oneCore.aiAssistantModel.getModelIdForTopic(topicId);
          if (modelId) {
            const contactManager = this.oneCore.aiAssistantModel.getContactManager();
            const aiPersonId = contactManager.getPersonIdForModel(modelId);
            if (aiPersonId) {
              currentParticipants.push(aiPersonId);
            }
          }
        }
      } catch (e) {
        console.warn(`[TopicGroupManager] Could not get current participants for legacy topic:`, (e as Error).message);
      }

      // Create a group for this legacy topic with current participants PLUS new participants
      const allParticipants = [...currentParticipants, ...participants];
      console.log(`[TopicGroupManager] Creating NEW group with ${allParticipants.length} participants`);

      const groupName = `conversation-${topicId}`;

      // 1. Create HashGroup with members
      const hashGroup = {
        $type$: 'HashGroup' as const,
        person: new Set(allParticipants)
      };
      const storedHashGroup: any = await this.storageDeps.storeUnversionedObject(hashGroup as any);

      // 2. Create Group referencing the HashGroup
      const group = {
        $type$: 'Group' as const,
        name: groupName,
        hashGroup: storedHashGroup.hash
      };

      const storedGroup: any = await this.storageDeps.storeVersionedObject(group as any);
      groupIdHash = storedGroup.idHash;

      console.log(`[TopicGroupManager] ✅ Stored NEW group with ID hash: ${String(groupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] Group participants:`, allParticipants.map((p: any) => String(p).substring(0, 8)));

      // Cache the group and add to allowed list
      this.conversationGroups.set(topicId, groupIdHash!);
      this.allowedGroups.add(groupIdHash!);
      console.log(`[TopicGroupManager] ✅ Cached group hash ${String(groupIdHash!).substring(0, 8)} for topic ${topicId}`);
      console.log(`[TopicGroupManager] ✅ Added group to allowed groups`);

      console.log(`[TopicGroupManager] Created group for legacy topic ${topicId} with ${allParticipants.length} participants`);
    } else {
      console.log(`[TopicGroupManager] Group EXISTS in cache: ${String(groupIdHash).substring(0, 8)}`);

      // Group exists - retrieve it, add new participants, store new version
      console.log(`[TopicGroupManager] Retrieving group from storage using ID hash: ${String(groupIdHash).substring(0, 8)}`);

      // 1. Load existing Group
      const result: any = await this.storageDeps.getObjectByIdHash(groupIdHash);
      const existingGroup: any = result.obj;

      if (!existingGroup) {
        throw new Error(`Group ${String(groupIdHash).substring(0, 8)} not found`);
      }

      // 2. Load existing HashGroup to get current members
      const hashGroupResult: any = await this.storageDeps.getObject(existingGroup.hashGroup);
      const currentMembers: any = hashGroupResult.members || [];

      console.log(`[TopicGroupManager] Retrieved existing group with ${currentMembers.length} participants`);
      console.log(`[TopicGroupManager] Existing participants:`, currentMembers.map((p: any) => String(p).substring(0, 8)));

      // Filter out participants that are already in the group
      const newMembers = participants.filter((p: any) => !currentMembers.includes(p));

      if (newMembers.length === 0) {
        console.log(`[TopicGroupManager] All participants already in group for topic ${topicId}`);
        console.log(`[TopicGroupManager] ========== ADD PARTICIPANTS END (no changes) ==========`);
        return;
      }

      console.log(`[TopicGroupManager] Adding ${newMembers.length} NEW members to group`);

      // 3. Create new HashGroup with added members
      const newHashGroup = {
        $type$: 'HashGroup' as const,
        person: new Set([...currentMembers, ...newMembers])
      };
      const storedHashGroup: any = await this.storageDeps.storeUnversionedObject(newHashGroup as any);

      // 4. Create new Group version pointing to new HashGroup
      const updatedGroup = {
        $type$: 'Group' as const,
        $versionHash$: existingGroup.$versionHash$,  // Link to previous version
        name: existingGroup.name,
        hashGroup: storedHashGroup.hash
      };

      console.log(`[TopicGroupManager] Storing UPDATED group with ${[...currentMembers, ...newMembers].length} participants`);
      const storedGroup: any = await this.storageDeps.storeVersionedObject(updatedGroup as any);
      const newGroupIdHash = storedGroup.idHash;

      console.log(`[TopicGroupManager] ✅ Stored UPDATED group with NEW ID hash: ${String(newGroupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] OLD group hash: ${String(groupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] NEW group hash: ${String(newGroupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] Updated group participants:`, [...currentMembers, ...newMembers].map((p: any) => String(p).substring(0, 8)));

      // Update cache with new version and add to allowed list
      this.conversationGroups.set(topicId, newGroupIdHash);
      this.allowedGroups.add(newGroupIdHash);
      console.log(`[TopicGroupManager] ✅ Updated cache: topic ${topicId} -> ${String(newGroupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] ✅ Added updated group to allowed groups`);

      console.log(`[TopicGroupManager] Updated group for topic ${topicId}: added ${newMembers.length} new participants (total: ${[...currentMembers, ...newMembers].length})`);

      groupIdHash = newGroupIdHash;
    }

    // Grant access to the new participants
    await this.storageDeps.createAccess([{
      id: groupIdHash,
      person: participants,
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }]);

    console.log(`[TopicGroupManager] ✅ Granted access to ${participants.length} participants for group ${String(groupIdHash).substring(0, 8)}`);
    console.log(`[TopicGroupManager] ========== ADD PARTICIPANTS END ==========`);
  }

  /**
   * Query IdAccess objects to find the group for a topic
   * This is the persistent way to find groups - IdAccess stores the topic→group relationship
   * @param {string} topicId - The topic ID
   * @returns {Promise<SHA256IdHash<Group> | null>} The group ID hash or null if not found
   */
  async getGroupForTopic(topicId: any): Promise<SHA256IdHash<any> | null> {
    console.log(`[TopicGroupManager] Querying for group in topic: ${topicId}`);

    // First check cache
    if (this.conversationGroups.has(topicId)) {
      const cachedGroupIdHash = this.conversationGroups.get(topicId);
      console.log(`[TopicGroupManager] Found cached group: ${String(cachedGroupIdHash).substring(0, 8)}`);
      return cachedGroupIdHash!;
    }

    try {
      // CRITICAL: Use IdAccess reverse maps to find group (privacy-preserving)
      // Query topic to get its channel, then query IdAccess for that channel
      const topic = await this.oneCore.topicModel.topics.queryById(topicId);

      if (topic && topic.channel) {
        // Query IdAccess reverse maps to find which group has access to this channel
        const idAccessHashes = await getAllEntries(topic.channel, 'IdAccess');

        for (const idAccessHash of idAccessHashes) {
          const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
          const idAccess: any = await getObject(idAccessHash);

          if (idAccess && idAccess.group && idAccess.group.length > 0) {
            const groupIdHash = idAccess.group[0];
            console.log(`[TopicGroupManager] Found group via IdAccess reverse map: ${String(groupIdHash).substring(0, 8)}`);

            // Cache it for future lookups
            this.conversationGroups.set(topicId, groupIdHash);

            return groupIdHash;
          }
        }
      }

      console.log(`[TopicGroupManager] No group found in IdAccess objects for topic ${topicId}`);
      return null;
    } catch (error) {
      console.error(`[TopicGroupManager] Error querying IdAccess:`, error);
      return null;
    }
  }

  /**
   * Get all participants for a topic from its group
   * @param {string} topicId - The topic ID
   * @returns {Promise<string[]>} Array of participant person IDs
   */
  async getTopicParticipants(topicId: any): Promise<string[]> {
    console.log(`[TopicGroupManager] ========== GET PARTICIPANTS START ==========`);
    console.log(`[TopicGroupManager] Topic: ${topicId}`);

    // Query IdAccess to find the group (this works across restarts)
    const groupIdHash = await this.getGroupForTopic(topicId);

    if (!groupIdHash) {
      console.log(`[TopicGroupManager] ⚠️  No group found for topic - needs to be created`);
      console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END (no group) ==========`);
      throw new Error(`No group found for topic ${topicId}`);
    }

    console.log(`[TopicGroupManager] Retrieving group from storage using ID hash: ${String(groupIdHash).substring(0, 8)}`);

    const result: any = await this.storageDeps.getObjectByIdHash(groupIdHash);
    const group: any = result.obj;

    if (!group) {
      console.log(`[TopicGroupManager] ⚠️  Group object not found in storage - removing from cache`);
      this.conversationGroups.delete(topicId);
      console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END (not found) ==========`);
      throw new Error(`Group ${String(groupIdHash).substring(0, 8)} not found in storage`);
    }

    console.log(`[TopicGroupManager] Retrieved group with ${group.person?.length || 0} participants`);
    console.log(`[TopicGroupManager] Participants:`, (group.person || []).map((p: any) => String(p).substring(0, 8)));

    if (!group.person || group.person.length === 0) {
      console.log(`[TopicGroupManager] ⚠️  BROKEN GROUP DETECTED: Group ${String(groupIdHash).substring(0, 8)} has no participants`);
      console.log(`[TopicGroupManager] This is a legacy bug - removing from cache so it will be recreated`);
      this.conversationGroups.delete(topicId);
      console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END (broken group) ==========`);
      throw new Error(`No group found for topic ${topicId}`);
    }

    console.log(`[TopicGroupManager] ✅ Returning ${group.person.length} participants`);
    console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END ==========`);
    return group.person;
  }

  /**
   * Ensure participant has their own channel for a group they're part of
   * This should be called when a participant discovers they're in a group
   * @param {string} topicId - The topic ID
   * @param {string} groupIdHash - The group's ID hash
   */
  async ensureParticipantChannel(topicId: any, groupIdHash: any): Promise<any> {
    console.log(`[TopicGroupManager] Ensuring participant has channel for topic ${topicId}`);

    if (!this.oneCore.channelManager) {
      throw new Error('ChannelManager not initialized');
    }

    try {
      // Check if we already have our channel
      const hasChannel = await this.oneCore.channelManager.hasChannel(topicId, this.oneCore.ownerId);

      if (!hasChannel) {
        // Create our channel for this topic
        await this.oneCore.channelManager.createChannel(topicId, this.oneCore.ownerId);
        console.log(`[TopicGroupManager] Created our channel for topic ${topicId}`);

        // Grant the group access to our channel
        const channelHash: any = await this.storageDeps.calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: topicId,
          owner: this.oneCore.ownerId
        });

        await this.storageDeps.createAccess([{
          id: channelHash,
          person: [],
          group: [groupIdHash],
          mode: SET_ACCESS_MODE.ADD
        }]);

        console.log(`[TopicGroupManager] Granted group ${String(groupIdHash).substring(0, 8)} access to our channel`);
      } else {
        console.log(`[TopicGroupManager] We already have a channel for topic ${topicId}`);
      }

      return true;
    } catch (error) {
      console.error(`[TopicGroupManager] Failed to ensure participant channel:`, error);
      throw error;
    }
  }

  /**
   * Initialize group sync listener
   * Listens for Group objects received via CHUM and creates channels for them
   */
  initializeGroupSyncListener(): void {
    console.log(`[TopicGroupManager] Initializing group sync listener...`);

    // Import onVersionedObj event from ONE.core
    import('@refinio/one.core/lib/storage-versioned-objects.js').then(({ onVersionedObj }) => {
      onVersionedObj.addListener(async (result: any) => {
        // Only process Group objects
        if (result.obj.$type$ !== 'Group') {
          return;
        }

        await this.handleReceivedGroup(result.idHash, result.obj);
      });

      console.log(`[TopicGroupManager] ✅ Group sync listener initialized`);
    }).catch(error => {
      console.error(`[TopicGroupManager] Failed to initialize group sync listener:`, error);
    });
  }

  /**
   * Handle a received Group object
   * Called either from the event listener or explicitly when a group is received
   */
  async handleReceivedGroup(groupIdHash: any, group: any): Promise<void> {
    console.log(`[TopicGroupManager] Processing received Group: ${group.name}`);

    try {
      // Only process conversation groups
      const topicIdMatch = group.name?.match(/^conversation-(.+)$/);
      if (!topicIdMatch) {
        return; // Not a conversation group
      }

      const topicId = topicIdMatch[1];

      // Skip if we already have this group cached (we created it ourselves)
      const existingGroup = this.conversationGroups.get(topicId);
      if (existingGroup && String(existingGroup) === String(groupIdHash)) {
        console.log(`[TopicGroupManager] Skipping self-created group for topic ${topicId}`);
        return;
      }

      // Load the HashGroup to get members
      const hashGroupResult: any = await this.storageDeps.getObject(group.hashGroup);
      const members: any = hashGroupResult.members || [];

      // Check if we're a member of this group
      const isMember = members.some((m: any) => String(m) === String(this.oneCore.ownerId));

      if (!isMember) {
        console.log(`[TopicGroupManager] Not a member of group ${group.name}`);
        return;
      }

      console.log(`[TopicGroupManager] We are a member of group for topic ${topicId}`);

      // Cache the group
      this.conversationGroups.set(topicId, groupIdHash);

      // Check if we have a channel for this topic
      const hasChannel = await this.oneCore.channelManager.hasChannel(topicId, this.oneCore.ownerId);

      if (!hasChannel) {
        console.log(`[TopicGroupManager] Creating our owned channel for topic ${topicId}`);

        // Create our owned channel
        await this.oneCore.channelManager.createChannel(topicId, this.oneCore.ownerId);

        // Grant the group access to our channel
        const channelHash: any = await this.storageDeps.calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: topicId,
          owner: this.oneCore.ownerId
        });

        await this.storageDeps.createAccess([{
          id: channelHash,
          person: [],
          group: [groupIdHash],
          mode: SET_ACCESS_MODE.ADD
        }]);

        console.log(`[TopicGroupManager] ✅ Created owned channel for topic ${topicId}`);

        // Check if topic exists locally, if not create it
        try {
          await this.oneCore.topicModel.topics.queryById(topicId);
        } catch (error) {
          // Topic doesn't exist locally - create a reference (group will be found via IdAccess)
          console.log(`[TopicGroupManager] Creating local topic reference for ${topicId}`);
          await this.oneCore.topicModel.createGroupTopic(topicId, topicId, this.oneCore.ownerId);
          console.log(`[TopicGroupManager] ✅ Created local topic reference`);
        }
      } else {
        console.log(`[TopicGroupManager] Already have channel for topic ${topicId}`);
      }
    } catch (error) {
      console.error(`[TopicGroupManager] Error processing received group:`, error);
    }
  }

  /**
   * @deprecated This method is deprecated - use initializeGroupSyncListener() instead
   * Kept for backwards compatibility
   */
  async syncReceivedGroups(): Promise<void> {
    console.log(`[TopicGroupManager] syncReceivedGroups() called - this method is deprecated`);
    console.log(`[TopicGroupManager] Group sync now happens automatically via onVersionedObj listener`);
    console.log(`[TopicGroupManager] Call initializeGroupSyncListener() during initialization instead`);
  }

  /**
   * @deprecated Do not use - creates duplicate conversations
   * P2P conversations should always use personId1<->personId2 format
   */
  async ensureP2PChannelsForProfile(someoneId: any, peerPersonId: any): Promise<any> {
    console.warn(`[TopicGroupManager] DEPRECATED: ensureP2PChannelsForProfile called - redirecting to ensureP2PChannelsForPeer`);
    // Redirect to the proper method
    return this.ensureP2PChannelsForPeer(peerPersonId);
  }

  /**
   * Ensure channels exist for P2P conversations with a specific peer
   * This is called when a CHUM connection is established
   * @param {string} peerPersonId - The peer's person ID
   */
  async ensureP2PChannelsForPeer(peerPersonId: any): Promise<any> {
    console.log(`[TopicGroupManager] Ensuring P2P conversation for peer ${String(peerPersonId).substring(0, 8)}`);

    // Use sorted Person IDs for consistent topic ID
    const sortedIds = [this.oneCore.ownerId, peerPersonId].sort();
    const p2pTopicId = `${sortedIds[0]}<->${sortedIds[1]}`;

    console.log(`[TopicGroupManager] P2P Topic ID: ${p2pTopicId}`);

    try {
      // Check if topic already exists
      let topic = null;
      try {
        if (this.oneCore.topicModel) {
          topic = await this.oneCore.topicModel.topics.queryById(p2pTopicId);
        }
      } catch (e: any) {
        // Topic doesn't exist yet
      }

      if (!topic) {
        console.log(`[TopicGroupManager] Creating P2P topic...`);

        // Get the contact's actual name if available, otherwise use their hash
        let topicName = String(peerPersonId).substring(0, 8);
        try {
          if (this.oneCore.leuteModel) {
            const contactName = this.oneCore.leuteModel.getPersonName(peerPersonId);
            if (contactName) {
              topicName = contactName;
            }
          }
        } catch (e: any) {
          // Fall back to hash if name lookup fails
        }

        await this.createP2PTopic(topicName, p2pTopicId, [this.oneCore.ownerId, peerPersonId]);

        console.log(`[TopicGroupManager] ✅ Created P2P topic and channel for ${p2pTopicId}`);
      } else {
        console.log(`[TopicGroupManager] P2P topic already exists for ${p2pTopicId}`);

        // Check what channels exist for this topic
        const channels: any = await this.oneCore.channelManager.getMatchingChannelInfos({channelId: p2pTopicId});
        console.log(`[TopicGroupManager] Existing channels for P2P topic:`, channels.map((ch: any) => ({
          id: ch.id,
          owner: ch.owner ? ch.owner?.substring(0, 8) : 'null'
        })));

        // For P2P, we should have ONE channel with null owner
        // If we have channels with owners, we need to fix this
        const hasNullOwnerChannel = channels.some((ch: any) => !ch.owner);
        const hasOwnerChannels = channels.some((ch: any) => ch.owner);

        if (!hasNullOwnerChannel) {
          console.warn(`[TopicGroupManager] ⚠️ P2P topic missing null-owner channel, creating it...`);

          // Create the null-owner channel for P2P
          await this.oneCore.channelManager.createChannel(p2pTopicId, null);
          console.log(`[TopicGroupManager] Created null-owner channel for existing P2P topic`);
        }

        // ALWAYS ensure access is granted for the null-owner channel
        // This is critical - even if the channel exists, the peer might not have access
        const channelHash: any = await this.storageDeps.calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: p2pTopicId,
          owner: undefined
        });

        await this.storageDeps.createAccess([{
          id: channelHash,
          person: [this.oneCore.ownerId, peerPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }]);

        console.log(`[TopicGroupManager] ✅ Ensured P2P channel access for both participants`);

        // Also ensure access to the Topic object itself (like one.leute does)
        if (topic) {
          const topicHash: any = await this.storageDeps.calculateHashOfObj(topic);
          await this.storageDeps.createAccess([{
            object: topicHash,
            person: [this.oneCore.ownerId, peerPersonId],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }]);
          console.log(`[TopicGroupManager] ✅ Ensured Topic object access for both participants`);
        }

        if (hasOwnerChannels) {
          console.warn(`[TopicGroupManager] ⚠️ P2P topic has owned channels - these should be removed`);
          console.warn(`[TopicGroupManager] P2P should only have null-owner channel for shared access`);
        }
      }

    } catch (error) {
      console.error(`[TopicGroupManager] Failed to ensure P2P channels:`, error);
    }
  }
}

export default TopicGroupManager;