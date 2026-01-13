/**
 * Module augmentation for ONE object types used by chat.core
 *
 * Topic is defined in one.models/src/recipes/ChatRecipes.ts and registered there.
 * ChatMessage is specific to chat.core's Story+Cube architecture.
 *
 * @see docs/designs/STORY-CUBE-CHAT-ARCHITECTURE.md
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

// Re-export Topic from one.models - this is the canonical definition
export type { Topic, TopicAISettings } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';

// From one.models/src/recipes/Certificates/AffirmationCertificate.ts
export interface AffirmationCertificate {
  $type$: 'AffirmationCertificate';
  data: SHA256Hash;
  license: SHA256Hash;
}

// Forward declaration for BlobDescriptor
interface BlobDescriptor {
  $type$: 'BlobDescriptor';
}

/**
 * ChatMessage - Pure data with semantic relationships
 *
 * Identity fields: id, topic, replyTo, reaction
 * Mutable fields: content, attachments, deleted, deletedReason
 */
export interface ChatMessage {
  $type$: 'ChatMessage';
  /** UUID - stable across edits */
  id: string;
  /** Which conversation this message belongs to */
  topic: SHA256IdHash<Topic>;
  /** Parent message for replies/reactions */
  replyTo?: SHA256Hash<ChatMessage>;
  /** Emoji for reactions */
  reaction?: string;
  /** Message text */
  content?: string;
  /** File attachments */
  attachments?: SHA256Hash<BlobDescriptor>[];
  /** Tombstone marker */
  deleted?: boolean;
  /** Reason for deletion */
  deletedReason?: string;
}

declare module '@OneObjectInterfaces' {
  // Add to OneUnversionedObjectInterfaces so getAllEntries() type checks pass
  export interface OneUnversionedObjectInterfaces {
    AffirmationCertificate: AffirmationCertificate;
  }

  // ChatMessage is chat.core specific (uses Story+Cube, not ChannelManager)
  // Topic is already registered by one.models/src/recipes/ChatRecipes.ts
  export interface OneVersionedObjectInterfaces {
    ChatMessage: ChatMessage;
  }
}
