/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation group operations.
 * Delegates to TopicGroupManager for low-level Group creation.
 */

import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Group, Person } from '@refinio/one.core/lib/recipes.js';
import type { TopicGroupManager } from '../models/TopicGroupManager.js';

// Request/Response types
export interface CreateGroupRequest {
  topicId: string;
  topicName: string;
  participants: SHA256IdHash<Person>[];
  autoAddChumConnections?: boolean;
}

export interface CreateGroupResponse {
  success: boolean;
  groupIdHash?: SHA256IdHash<Group>;
  error?: string;
}

export interface GetGroupForTopicRequest {
  topicId: string;
}

export interface GetGroupForTopicResponse {
  success: boolean;
  groupIdHash?: SHA256IdHash<Group>;
  participants?: string[];
  error?: string;
}

export interface GetTopicParticipantsRequest {
  topicId: string;
}

export interface GetTopicParticipantsResponse {
  success: boolean;
  participants?: string[];
  error?: string;
}

/**
 * GroupPlan - Pure business logic for conversation group operations
 *
 * Dependencies injected via constructor:
 * - topicGroupManager: Low-level Group/Topic operations
 * - nodeOneCore: ONE.core instance for owner/instanceVersion
 */
export class GroupPlan {
  static get planId(): string { return 'group'; }
  static get planName(): string { return 'Group'; }
  static get description(): string { return 'Manages conversation groups'; }
  static get version(): string { return '1.0.0'; }

  private topicGroupManager: TopicGroupManager;
  private nodeOneCore: any;

  constructor(
    topicGroupManager: TopicGroupManager,
    nodeOneCore: any
  ) {
    this.topicGroupManager = topicGroupManager;
    this.nodeOneCore = nodeOneCore;
  }

  /**
   * Create a conversation group for a topic
   */
  async createGroup(request: CreateGroupRequest): Promise<CreateGroupResponse> {
    console.log(`[GroupPlan] Creating group for topic ${request.topicId} with ${request.participants.length} participants`);

    try {
      await this.topicGroupManager.createGroupTopic(
        request.topicName,
        request.topicId,
        request.participants,
        request.autoAddChumConnections || false
      );

      const groupIdHash = this.topicGroupManager.getCachedGroupForTopic(request.topicId);

      if (!groupIdHash) {
        throw new Error(`Group creation failed - no groupIdHash in cache for topic ${request.topicId}`);
      }

      console.log(`[GroupPlan] Created group ${String(groupIdHash).substring(0, 8)} for topic ${request.topicId}`);

      return {
        success: true,
        groupIdHash
      };
    } catch (error) {
      console.error('[GroupPlan] Error creating group:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get group for a topic
   */
  async getGroupForTopic(request: GetGroupForTopicRequest): Promise<GetGroupForTopicResponse> {
    try {
      const groupIdHash = await this.topicGroupManager.getGroupForTopic(request.topicId);

      if (!groupIdHash) {
        return {
          success: false,
          error: `No group found for topic ${request.topicId}`
        };
      }

      const participants = await this.topicGroupManager.getTopicParticipants(request.topicId);

      return {
        success: true,
        groupIdHash,
        participants
      };
    } catch (error) {
      console.error('[GroupPlan] Error getting group for topic:', error);
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
}
