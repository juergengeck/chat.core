/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation topic operations.
 * Uses TopicModel for topic creation and access control.
 *
 * Architecture:
 *   Topic → channel (ChannelInfo) → participants (HashGroup)
 *        → group (Group, for group conversations)
 *
 * CHUM follows all references automatically when Topic is shared.
 */

import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person, Group, HashGroup } from '@refinio/one.core/lib/recipes.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { ChannelInfo } from '@refinio/one.models/lib/recipes/ChannelRecipes.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';

/**
 * Result from creating a topic
 */
export interface CreateTopicResult {
  topic: Topic;
  topicIdHash: SHA256IdHash<Topic>;
  channelInfoIdHash: SHA256IdHash<ChannelInfo>;
  participantsHash: SHA256Hash<HashGroup<Person>>;
}

/**
 * Storage dependencies for GroupPlan
 * Note: Generic methods use 'any' to avoid constraint issues with ONE.core's
 * complex type system. Runtime behavior is correct; these are just type signatures
 * for the dependency injection pattern.
 */
export interface GroupPlanStorageDeps {
  getObjectByIdHash: (idHash: SHA256IdHash<any>) => Promise<{ obj: any }>;
  getObject: (hash: SHA256Hash<any>) => Promise<any>;
  calculateIdHashOfObj: (obj: any) => Promise<SHA256IdHash<any>>;
  storeUnversionedObject: (obj: any) => Promise<{ hash: SHA256Hash<any> }>;
  storeVersionedObject: (obj: any) => Promise<{ hash: SHA256Hash<any>; idHash: SHA256IdHash<any> }>;
}

export interface CreateTopicRequest {
  topicId: string;
  topicName: string;
  participants: SHA256IdHash<Person>[];
}

export interface CreateTopicResponse {
  success: boolean;
  topicIdHash?: SHA256IdHash<Topic>;
  channelInfoIdHash?: SHA256IdHash<ChannelInfo>;
  participantsHash?: SHA256Hash<HashGroup>;
  error?: string;
}

export interface GetTopicRequest {
  topicId: string;
}

export interface GetTopicResponse {
  success: boolean;
  topicIdHash?: SHA256IdHash<Topic>;
  channelInfoIdHash?: SHA256IdHash<ChannelInfo>;
  participants?: SHA256IdHash<Person>[];
  error?: string;
}

export interface GetTopicParticipantsRequest {
  topicId: string;
}

export interface GetTopicParticipantsResponse {
  success: boolean;
  participants?: SHA256IdHash<Person>[];
  error?: string;
}

export interface AddParticipantsRequest {
  topicId: string;
  participants: SHA256IdHash<Person>[];
}

export interface AddParticipantsResponse {
  success: boolean;
  error?: string;
}

/**
 * GroupPlan - Pure business logic for conversation topic operations
 *
 * Dependencies injected via constructor:
 * - topicModel: TopicModel for topic creation and queries
 * - storageDeps: Storage functions for object access
 */
export class GroupPlan {
  static get planId(): string { return 'group'; }
  static get planName(): string { return 'Group'; }
  static get description(): string { return 'Manages conversation topics via TopicModel'; }
  static get version(): string { return '4.0.0'; }

  private topicModel: TopicModel;
  private storageDeps: GroupPlanStorageDeps;
  private ownerId: SHA256IdHash<Person>;

  // Cache: topicId -> topicIdHash (for quick lookups)
  private topicCache: Map<string, SHA256IdHash<Topic>>;

  constructor(topicModel: TopicModel, storageDeps: GroupPlanStorageDeps, ownerId: SHA256IdHash<Person>) {
    this.topicModel = topicModel;
    this.storageDeps = storageDeps;
    this.ownerId = ownerId;
    this.topicCache = new Map();
  }

  /**
   * Create a conversation topic with participants
   *
   * Creates HashGroup -> Group -> Topic with proper structure.
   * TopicModel.createGroupTopic expects a Group ID hash.
   */
  async createTopic(request: CreateTopicRequest): Promise<CreateTopicResponse> {
    console.log(`[GroupPlan] ========== CREATE TOPIC START ==========`);
    console.log(`[GroupPlan] topicId: ${request.topicId}`);
    console.log(`[GroupPlan] topicName: ${request.topicName}`);
    console.log(`[GroupPlan] this.ownerId: ${String(this.ownerId)}`);
    console.log(`[GroupPlan] this.ownerId type: ${typeof this.ownerId}`);
    console.log(`[GroupPlan] request.participants count: ${request.participants.length}`);
    console.log(`[GroupPlan] request.participants:`, request.participants.map(p => String(p).substring(0, 16)));

    try {
      // Ensure owner is included in participants
      const allParticipants = [...request.participants];
      const ownerAlreadyIncluded = allParticipants.some(p => String(p) === String(this.ownerId));
      console.log(`[GroupPlan] Owner already in participants? ${ownerAlreadyIncluded}`);

      if (!ownerAlreadyIncluded) {
        allParticipants.unshift(this.ownerId);
        console.log(`[GroupPlan] Added owner to participants`);
      }

      console.log(`[GroupPlan] Final allParticipants count: ${allParticipants.length}`);
      console.log(`[GroupPlan] Final allParticipants:`, allParticipants.map(p => String(p).substring(0, 16)));

      // Step 1: Create HashGroup with participants
      const hashGroupObj: HashGroup<Person> = {
        $type$: 'HashGroup',
        person: new Set(allParticipants)
      };
      console.log(`[GroupPlan] HashGroup person Set size: ${hashGroupObj.person.size}`);
      console.log(`[GroupPlan] HashGroup members:`, Array.from(hashGroupObj.person).map(p => String(p).substring(0, 16)));

      const hashGroupResult = await this.storageDeps.storeUnversionedObject(hashGroupObj);
      const hashGroupHash = hashGroupResult.hash as SHA256Hash<HashGroup<Person>>;

      console.log(`[GroupPlan] Created HashGroup: ${String(hashGroupHash).substring(0, 8)}`);

      // Step 2: Create Group referencing HashGroup
      const groupObj: Group = {
        $type$: 'Group',
        name: request.topicName || `group-${request.topicId}`,
        hashGroup: hashGroupHash
      };
      const groupResult = await this.storageDeps.storeVersionedObject(groupObj);
      const groupIdHash = groupResult.idHash as SHA256IdHash<Group>;

      console.log(`[GroupPlan] Created Group: ${String(groupIdHash).substring(0, 8)}`);

      // Step 3: Create topic via TopicModel with Group ID hash
      // Channel identity is based on participants only (no owner), ensuring
      // consistent idHash across all participants.
      const topic = await this.topicModel.createGroupTopic(
        request.topicName,
        groupIdHash,
        request.topicId
      );

      const topicIdHash = await this.storageDeps.calculateIdHashOfObj(topic);

      // Get ChannelInfo to extract participantsHash
      const channelInfoResult = await this.storageDeps.getObjectByIdHash(topic.channel);
      const channelInfo: ChannelInfo = channelInfoResult.obj;

      // Cache the topic
      this.topicCache.set(request.topicId, topicIdHash);

      console.log(`[GroupPlan] Created topic ${String(topicIdHash).substring(0, 8)}`);

      return {
        success: true,
        topicIdHash,
        channelInfoIdHash: topic.channel,
        participantsHash: channelInfo.participants
      };
    } catch (error) {
      console.error('[GroupPlan] Error creating topic:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get topic info for a conversation
   */
  async getTopic(request: GetTopicRequest): Promise<GetTopicResponse> {
    try {
      // Try cache first
      let topicIdHash = this.topicCache.get(request.topicId);

      // If not in cache, try to find via TopicModel
      if (!topicIdHash) {
        const topic = await this.topicModel.findTopic(request.topicId);
        if (!topic) {
          return {
            success: false,
            error: `No topic found for topicId ${request.topicId}`
          };
        }
        topicIdHash = await this.storageDeps.calculateIdHashOfObj(topic);
        this.topicCache.set(request.topicId, topicIdHash);
      }

      const participants = await this.getParticipantsForTopic(request.topicId);

      return {
        success: true,
        topicIdHash,
        participants
      };
    } catch (error) {
      console.error('[GroupPlan] Error getting topic:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get participants for a topic from its ChannelInfo
   */
  private async getParticipantsForTopic(topicId: string): Promise<SHA256IdHash<Person>[]> {
    const topic = await this.topicModel.findTopic(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    // Get ChannelInfo
    const channelInfoResult = await this.storageDeps.getObjectByIdHash(topic.channel);
    const channelInfo: ChannelInfo = channelInfoResult.obj;

    // Get HashGroup
    const hashGroup = await this.storageDeps.getObject(channelInfo.participants);
    const personSet: Set<SHA256IdHash<Person>> = (hashGroup as HashGroup<Person>).person || new Set();

    return Array.from(personSet);
  }

  /**
   * Get participants for a topic
   */
  async getTopicParticipants(request: GetTopicParticipantsRequest): Promise<GetTopicParticipantsResponse> {
    try {
      const participants = await this.getParticipantsForTopic(request.topicId);

      return {
        success: true,
        participants
      };
    } catch (error) {
      console.error('[GroupPlan] Error getting topic participants:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Add participants to an existing topic
   */
  async addParticipants(request: AddParticipantsRequest): Promise<AddParticipantsResponse> {
    console.log(`[GroupPlan] Adding ${request.participants.length} participants to topic ${request.topicId}`);

    try {
      const topic = await this.topicModel.findTopic(request.topicId);
      if (!topic) {
        throw new Error(`Topic ${request.topicId} not found`);
      }

      // Use TopicModel to add participants
      await this.topicModel.addPersonsToTopic(request.participants, topic);

      return { success: true };
    } catch (error) {
      console.error('[GroupPlan] Error adding participants:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get cached topic ID hash
   */
  getCachedTopicForConversation(topicId: string): SHA256IdHash<Topic> | undefined {
    return this.topicCache.get(topicId);
  }
}
