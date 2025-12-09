/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation group operations with Story/Assembly tracking.
 * Delegates to TopicGroupManager for low-level Group creation.
 * Creates Assemblies to document Group-Topic relationships (supply/demand semantics).
 *
 * Pattern based on refinio.api StoryFactory architecture.
 *
 * SELF-SUFFICIENT: GroupPlan creates its own StoryFactory and AssemblyPlan internally.
 * Platform code just needs to pass fundamental dependencies (oneCore, topicGroupManager, storage).
 */

import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Group, Person } from '@refinio/one.core/lib/recipes.js';
import type { TopicGroupManager } from '../models/TopicGroupManager.js';

// StoryFactory types (defined inline to avoid runtime dependency on refinio.api)
// These types match refinio.api/plan-system but are defined here for build-time only
export interface ExecutionContext {
  title: string;
  description: string;
  planId: SHA256IdHash<any>;
  owner: string;
  domain: string;
  instanceVersion: string;
  demand?: Demand;
  supply?: Supply;
  metadata?: Map<string, string>;
  matchScore?: number;
}

export interface Demand {
  domain: string;
  keywords: string[];
  trustLevel: 'me' | 'trusted' | 'group' | 'public';
  groupHash?: string;
  credentialFilters: Array<{ type: string }>;
}

export interface Supply {
  domain: string;
  keywords: string[];
  subjects: string[];
  ownerId: string;
  verifiableCredentials?: any[];
}

/**
 * Result of recordExecution - wraps operation result with Story/Assembly tracking.
 * On error, recordExecution throws - no error property needed.
 */
export interface ExecutionResult<T> {
  result: T;
  story?: {
    idHash: string;
    hash: string;
  };
  assembly?: {
    idHash: string;
    hash: string;
  };
}

export interface StoryFactory {
  recordExecution<T>(
    context: ExecutionContext,
    operation: () => Promise<T>
  ): Promise<ExecutionResult<T>>;
}

/**
 * Storage functions required for Assembly/Story tracking
 */
export interface StorageFunctions {
  storeVersionedObject: (obj: any) => Promise<{
    hash: SHA256Hash<any>;
    idHash: SHA256IdHash<any>;
    versionHash: SHA256Hash<any>;
  }>;
  getObjectByIdHash: (idHash: SHA256IdHash<any>) => Promise<any>;
  getObject: (hash: SHA256Hash<any>) => Promise<any>;
}

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
  assemblyIdHash?: string;
  storyIdHash?: string;
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
 * SELF-SUFFICIENT: Creates its own StoryFactory and AssemblyPlan internally.
 *
 * Dependencies injected via constructor:
 * - topicGroupManager: Low-level Group/Topic operations
 * - nodeOneCore: ONE.core instance for owner/instanceVersion
 * - storage: Storage functions for Assembly/Story tracking (optional - enables Story/Assembly)
 * - storyFactory: Advanced override for custom StoryFactory (optional - for power users)
 */
export class GroupPlan {
  static get planId(): string { return 'group'; }
  static get planName(): string { return 'Group'; }
  static get description(): string { return 'Manages conversation groups with Story/Assembly tracking'; }
  static get version(): string { return '1.0.0'; }

  private topicGroupManager: TopicGroupManager;
  private nodeOneCore: any;
  private storyFactory?: StoryFactory;
  private assemblyPlan?: any; // AssemblyPlan instance (optional)
  private topicAssemblies: Map<string, string>; // topicId -> assemblyIdHash

  constructor(
    topicGroupManager: TopicGroupManager,
    nodeOneCore: any,
    storageOrStoryFactory?: StorageFunctions | StoryFactory,
    assemblyPlan?: any
  ) {
    this.topicGroupManager = topicGroupManager;
    this.nodeOneCore = nodeOneCore;
    this.assemblyPlan = assemblyPlan;
    this.topicAssemblies = new Map();

    // Determine if we got StorageFunctions or StoryFactory
    if (storageOrStoryFactory) {
      if ('recordExecution' in storageOrStoryFactory) {
        // It's a StoryFactory (power user override)
        this.storyFactory = storageOrStoryFactory as StoryFactory;
      } else {
        // It's StorageFunctions - create AssemblyPlan and StoryFactory
        this.storyFactory = this.createStoryFactory(storageOrStoryFactory as StorageFunctions);
      }
    }
  }

  /**
   * Create StoryFactory with AssemblyPlan (internal wiring)
   */
  private createStoryFactory(storage: StorageFunctions): StoryFactory {
    // Inline minimal AssemblyPlan implementation
    const assemblyHandler = {
      async createStory(params: any) {
        const story = {
          $type$: 'AssemblyStory',
          id: params.id,
          title: params.title,
          description: params.description,
          plan: params.plan,
          product: params.product,
          instanceVersion: params.instanceVersion,
          outcome: params.outcome,
          success: params.success,
          metadata: params.metadata,
          actor: params.actor,
          created: Date.now(),
          duration: params.duration,
          owner: params.owner,
          domain: params.domain
        };

        const result = await storage.storeVersionedObject(story);
        return {
          story,
          hash: result.hash,
          idHash: result.idHash
        };
      },

      async createAssembly(params: any) {
        const assembly = {
          $type$: 'CubeAssembly',
          storyRef: params.storyRef,
          supply: params.supply,
          demand: params.demand,
          instanceVersion: params.instanceVersion,
          children: params.children,
          metadata: params.metadata,
          matchScore: params.matchScore,
          status: params.status || 'active',
          created: Date.now(),
          planRef: params.planRef,
          owner: params.owner,
          domain: params.domain
        };

        const result = await storage.storeVersionedObject(assembly);
        return {
          assembly,
          hash: result.hash,
          idHash: result.idHash
        };
      }
    };

    // Inline minimal StoryFactory implementation
    return {
      async recordExecution<T>(
        context: ExecutionContext,
        operation: () => Promise<T>
      ): Promise<ExecutionResult<T>> {
        const startTime = Date.now();

        try {
          const result = await operation();

          // Create Story
          const storyResult = await assemblyHandler.createStory({
            id: `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: context.title,
            description: context.description,
            plan: context.planId,
            product: '',
            instanceVersion: context.instanceVersion,
            success: true,
            matchScore: context.matchScore,
            metadata: context.metadata,
            duration: Date.now() - startTime,
            owner: context.owner,
            domain: context.domain
          });

          // Create Assembly if Supply/Demand provided
          let assemblyResult;
          if (context.supply && context.demand) {
            assemblyResult = await assemblyHandler.createAssembly({
              storyRef: storyResult.idHash,
              supply: context.supply,
              demand: context.demand,
              instanceVersion: context.instanceVersion,
              matchScore: context.matchScore,
              metadata: context.metadata,
              status: 'active',
              planRef: context.planId,
              owner: context.owner,
              domain: context.domain
            });
          }

          return {
            result,
            story: {
              hash: storyResult.hash as string,
              idHash: storyResult.idHash as string
            },
            assembly: assemblyResult
              ? {
                  hash: assemblyResult.hash as string,
                  idHash: assemblyResult.idHash as string
                }
              : undefined
          };
        } catch (error: any) {
          // Create Story for failed execution
          await assemblyHandler.createStory({
            id: `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: context.title,
            description: context.description,
            plan: context.planId,
            product: '',
            instanceVersion: context.instanceVersion,
            success: false,
            outcome: error?.message || 'Unknown error',
            matchScore: context.matchScore,
            metadata: context.metadata,
            duration: Date.now() - startTime,
            owner: context.owner,
            domain: context.domain
          });

          throw error;
        }
      }
    };
  }

  /**
   * Set StoryFactory after initialization (for gradual adoption or advanced customization)
   */
  setStoryFactory(factory: StoryFactory): void {
    this.storyFactory = factory;
  }

  /**
   * Get current instance version hash for Story/Assembly tracking
   */
  private getCurrentInstanceVersion(): string {
    // Try to get from nodeOneCore, fallback to timestamp if not available
    return this.nodeOneCore.instanceVersion || `instance-${Date.now()}`;
  }

  /**
   * Create a conversation group for a topic
   *
   * ASSEMBLY SEMANTICS:
   * - Demand: Topic needs a group with specific participants
   * - Supply: Group provides participant management and access control
   * - Match: Group creation satisfies topic's participant requirements
   */
  async createGroup(request: CreateGroupRequest): Promise<CreateGroupResponse> {
    console.log(`[GroupPlan] Creating group for topic ${request.topicId} with ${request.participants.length} participants`);

    // Use StoryFactory if available
    if (this.storyFactory) {
      return this.createGroupWithStory(request);
    }

    // Fallback: Direct creation without Story/Assembly
    return this.createGroupDirect(request);
  }

  /**
   * Create group with Story/Assembly tracking
   */
  private async createGroupWithStory(request: CreateGroupRequest): Promise<CreateGroupResponse> {
    try {
      const context: ExecutionContext = {
        title: `Create group for topic ${request.topicId}`,
        description: `Create conversation group "${request.topicName}" with ${request.participants.length} participants`,
        planId: GroupPlan.planId as any,
        owner: String(this.nodeOneCore.ownerId) as any,
        domain: 'conversation',
        instanceVersion: this.getCurrentInstanceVersion(),

        // ASSEMBLY: Demand (topic needs group) + Supply (group provides participants)
        demand: {
          domain: 'conversation',
          keywords: ['topic', 'group', 'participants', 'access-control'],
          trustLevel: 'me',
          credentialFilters: [],  // Required by recipe - no credential filtering needed
          groupHash: undefined  // Optional - explicitly undefined (not null)
        },
        supply: {
          domain: 'conversation',
          keywords: ['group', 'access-control', 'participant-management'],
          subjects: ['conversation-group'],
          ownerId: String(this.nodeOneCore.ownerId) as any
        },
        matchScore: 1.0,

        // Store Group metadata for future queries (Map<string, string>)
        metadata: new Map([
          ['topicId', request.topicId],
          ['topicName', request.topicName],
          ['participantCount', String(request.participants.length)],
          ['participants', request.participants.map(p => String(p)).join(',')]
        ])
      };

      const result: ExecutionResult<{ groupIdHash: SHA256IdHash<Group> }> = await this.storyFactory!.recordExecution(
        context,
        async () => {
          // Delegate to TopicGroupManager for actual Group creation
          await this.topicGroupManager.createGroupTopic(
            request.topicName,
            request.topicId,
            request.participants,
            request.autoAddChumConnections || false
          );

          // Get the created group from cache
          const groupIdHash = this.topicGroupManager.getCachedGroupForTopic(request.topicId);

          if (!groupIdHash) {
            throw new Error(`Group creation failed - no groupIdHash in cache for topic ${request.topicId}`);
          }

          console.log(`[GroupPlan] Created group ${String(groupIdHash).substring(0, 8)} for topic ${request.topicId}`);

          return { groupIdHash };
        }
      );

      return {
        success: true,
        groupIdHash: result.result.groupIdHash,
        assemblyIdHash: result.assembly?.idHash,
        storyIdHash: result.story?.idHash
      };
    } catch (error) {
      console.error('[GroupPlan] Error creating group with Story:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Create group without Story/Assembly (fallback)
   */
  private async createGroupDirect(request: CreateGroupRequest): Promise<CreateGroupResponse> {
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
   *
   * FUTURE: Query Assemblies by metadata.topicId when Assembly query API is available
   * CURRENT: Delegates to TopicGroupManager.getGroupForTopic() (IdAccess query)
   */
  async getGroupForTopic(request: GetGroupForTopicRequest): Promise<GetGroupForTopicResponse> {
    try {
      // TODO: Query Assemblies when query API is available:
      // const assemblies = await this.assemblyHandler.queryAssemblies({
      //   domain: 'conversation',
      //   'metadata.topicId': request.topicId
      // });

      // Current: Use IdAccess query from TopicGroupManager
      const groupIdHash = await this.topicGroupManager.getGroupForTopic(request.topicId);

      if (!groupIdHash) {
        return {
          success: false,
          error: `No group found for topic ${request.topicId}`
        };
      }

      // Get participants
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
