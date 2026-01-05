/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation topic operations.
 * Delegates to TopicGroupManager which uses Topic as the parent object.
 *
 * Architecture:
 *   Topic → channel (ChannelInfo) → participants (HashGroup)
 *        → channelCertificate (AffirmationCertificate)
 *
 * CHUM follows all references automatically when Topic is shared.
 */

import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person, HashGroup } from '@refinio/one.core/lib/recipes.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { ChannelInfo } from '@refinio/one.models/lib/recipes/ChannelRecipes.js';
import type { TopicGroupManager, CreateTopicResult } from '../models/TopicGroupManager.js';

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
 * - topicGroupManager: Topic/ChannelInfo operations
 */
export class GroupPlan {
  static get planId(): string { return 'group'; }
  static get planName(): string { return 'Group'; }
  static get description(): string { return 'Manages conversation topics via Topic/ChannelInfo sharing'; }
  static get version(): string { return '3.0.0'; }

  private topicGroupManager: TopicGroupManager;

  constructor(topicGroupManager: TopicGroupManager) {
    this.topicGroupManager = topicGroupManager;
  }

  /**
   * Create a conversation topic with participants
   */
  async createTopic(request: CreateTopicRequest): Promise<CreateTopicResponse> {
    console.log(`[GroupPlan] Creating topic ${request.topicId} with ${request.participants.length} participants`);

    try {
      const result: CreateTopicResult = await this.topicGroupManager.createGroupTopic(
        request.topicName,
        request.topicId,
        request.participants
      );

      console.log(`[GroupPlan] ✅ Created topic ${String(result.topicIdHash).substring(0, 8)}`);

      return {
        success: true,
        topicIdHash: result.topicIdHash,
        channelInfoIdHash: result.channelInfoIdHash,
        participantsHash: result.participantsHash
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
      const topicIdHash = this.topicGroupManager.getCachedTopicForConversation(request.topicId);

      if (!topicIdHash) {
        return {
          success: false,
          error: `No topic found for topicId ${request.topicId}`
        };
      }

      const participants = await this.topicGroupManager.getTopicParticipants(request.topicId);

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
   * Get participants for a topic
   */
  async getTopicParticipants(request: GetTopicParticipantsRequest): Promise<GetTopicParticipantsResponse> {
    try {
      const participants = await this.topicGroupManager.getTopicParticipants(request.topicId);

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
      await this.topicGroupManager.addParticipantsToTopic(request.topicId, request.participants);

      return { success: true };
    } catch (error) {
      console.error('[GroupPlan] Error adding participants:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}
