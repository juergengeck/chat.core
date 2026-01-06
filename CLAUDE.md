# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# chat.core

Platform-agnostic chat/messaging business logic for LAMA applications.

## CRITICAL: ONE/CHUM Architecture Principle

**We drive things from the ground up and respond to the environment.**

When the app layer needs to drive things, we **change the data landscape and let the system respond**. This allows us to use complexity instead of trying to harness it.

### What this means in practice:

**DON'T manually orchestrate:**
```typescript
// WRONG - trying to control the world
await shareCertificatesToPeer(peer1);
await shareCertificatesToPeer(peer2);
await trackPendingShares(peer3); // not connected yet
await shareWhenConnected(peer3); // manual mesh completion
```

**DO change data and let CHUM respond:**
```typescript
// RIGHT - change data, system responds
// Topic references everything needed via child objects:
//   Topic → channel (ChannelInfo) → participants (HashGroup)
//        → channelCertificate (AffirmationCertificate)
const topic = await createTopic(participants);
await grantAccess(topic, participants);
// CHUM automatically syncs Topic + all children to connected peers
// When peer3 connects later, CHUM syncs automatically - no tracking needed
```

### Key insight:

Objects with child references form complete graphs. CHUM fetches parent + all children atomically. No manual "pending share" tracking, no mesh completion logic, no orchestration.

**Share the root object → CHUM syncs the tree → receivers respond to complete data arriving.**

## IMPORTANT: Naming Convention

**"handler" → "plan" terminology**

All business logic classes use "plan" terminology throughout the codebase:
- Class names: `ChatPlan`, `ContactsPlan`, `ExportPlan`, `FeedForwardPlan`
- File names: `ChatPlan.ts`, `ContactsPlan.ts`, etc.
- Variables: `chatPlan`, `contactsPlan`, etc.
- Directory: `plans/` (not `handlers/`)

When writing new code, always use "plan" terminology for these classes.

## Build Commands

```bash
# Compile TypeScript (compiles to same directory as source)
npm run build

# Watch mode for development
npm run watch

# Clean generated files: .js, .d.ts, .js.map (preserves packages/ and node_modules/)
npm run clean
```

**Note**: The clean command removes all `.js` files (except in packages/ and node_modules/). TypeScript also generates `.d.ts` and `.js.map` files alongside source files - these should be manually removed if needed.

## Architecture Overview

### Build-Time vs Runtime Dependency Model

**Critical**: chat.core has zero runtime dependencies. All dependencies (@refinio/one.core, @refinio/one.models) are build-time only.

```
BUILD TIME:
  tsconfig.json paths: "@refinio/*" → "./packages/*"
  TypeScript compiles using local type definitions
  Result: Compiled .js/.d.ts files with no imports

RUNTIME:
  Consuming app (lama.electron/lama.browser) imports chat.core
  Consuming app provides its own @refinio/* instances
  chat.core plans use injected dependencies
  Result: Single shared instance across entire app
```

**Package Structure**:
- `packages/` - Build-time type definitions only (never bundled)
- Compiled JS output is co-located with source files (no `dist/` or `build/`)

### Directory Structure

```
chat.core/
├── plans/                 # Pure business logic plans (RPC-style interfaces)
│   ├── ChatPlan.ts            # Message/conversation operations
│   ├── GroupPlan.ts           # Group/topic management (uses TopicModel)
│   ├── ContactsPlan.ts        # Contact management
│   ├── ExportPlan.ts          # Export/import operations
│   └── FeedForwardPlan.ts     # Feed forward operations
├── services/              # Reusable service layer
│   ├── ContactService.ts      # Contact queries with AI detection
│   ├── ProfileService.ts      # Profile/avatar management
│   ├── P2PTopicService.ts     # P2P topic/channel creation
│   └── ContactCreation.ts     # Helper for creating Profile/Someone objects
├── models/                # Domain models (currently empty)
├── recipes/               # ONE recipe definitions
│   ├── LLMRecipe.ts           # LLM-related recipes
│   └── index.ts               # Recipe exports
├── types/                 # Custom type definitions
│   └── AvatarPreference.ts
└── packages/              # Build-time only (git-ignored symlinks)
    ├── one.core/
    └── one.models/
```

### Plan Pattern (Dependency Injection)

All plans follow this pattern:

```typescript
export class ChatPlan {
  constructor(
    private nodeOneCore: any,      // Platform's ONE.core instance
    private stateManager?: any,     // Optional platform services
    private messageVersionManager?: any
  ) {}

  async someMethod(request: SomeRequest): Promise<SomeResponse> {
    // Pure business logic using injected dependencies
    // Returns success/error response objects
  }
}
```

**Key Points**:
- Plans are transport-agnostic (work in Electron IPC, Web Workers, etc)
- All dependencies injected via constructor
- Methods accept typed request objects, return typed response objects
- No direct imports of platform-specific code

### Services vs Plans

**Plans**: RPC-style interfaces for transport layers (IPC, Workers)
- Request/Response pattern
- Transport-agnostic
- Examples: ChatPlan, GroupPlan, ContactsPlan, ExportPlan, FeedForwardPlan

**Services**: Reusable business logic components
- Direct method calls
- Used by plans or directly by platforms
- Examples: ContactService, ProfileService, P2PTopicService, ContactCreation

## Scope Boundaries

### ✅ What IS in chat.core

Chat-specific business logic that:
- Builds on one.models foundation
- Adds LAMA-specific chat features
- Is platform-agnostic
- Is NOT AI-related (that's lama.core)

**Contents**:
- Chat/messaging operations (ChatPlan)
- Contact management with AI detection (ContactService, ContactsPlan)
- Topic/conversation management (GroupPlan, ChatPlan.createGroupConversation)
- Profile and avatar management (ProfileService)
- P2P topic creation (P2PTopicService)
- Contact creation helpers (ContactCreation)
- Export/import operations (ExportPlan)
- Feed forward (FeedForwardPlan)
- LLM recipes (recipes/)

### ❌ What is NOT in chat.core

- AI/LLM functionality → See lama.core
- Platform infrastructure (Electron/Browser specifics) → See lama.electron/lama.browser
- ONE platform core models → See one.models
- Database/storage implementations → See one.core

## Key Implementation Details

### ContactService

Provides contact lists with LAMA-specific enhancements:

**Features**:
- Queries `LeuteModel.others()` from one.models
- AI contact detection via `AIAssistantModel.llmObjectManager.isLLMPerson()`
- Avatar color generation/persistence (AvatarPreference recipe)
- 5-second TTL caching
- Automatic deduplication by personId

**Usage Pattern**:
```typescript
const contactService = new ContactService(leuteModel, aiAssistantModel);
const contacts = await contactService.getContacts(); // Cached
contactService.invalidateContactsCache(); // Force refresh
```

### ProfileService

Avatar preference and profile management:

**Features**:
- Mood-based avatar colors
- PersonName management (delegates to one.models)
- Color persistence via AvatarPreference recipe
- Deterministic color generation from personId

### P2PTopicService

Platform-agnostic P2P (one-to-one) topic/channel creation:

**Features**:
- Creates topics for two participants
- Generates consistent topic IDs (lexicographically sorted)
- Sets up proper access permissions for both parties
- Used after successful pairing to enable immediate messaging

**Usage Pattern**:
```typescript
import { createP2PTopic } from '@chat/core/services/P2PTopicService.js';
const topicRoom = await createP2PTopic(topicModel, localPersonId, remotePersonId);
```

### ContactCreation

Helper for creating Profile and Someone objects for remote contacts:

**Features**:
- Creates Profile objects using ProfileModel API
- Creates Someone objects for contact relationships
- Prevents infinite loops with retry delay tracking
- Platform-agnostic (works in browser and Node.js)

### GroupPlan

Topic management using TopicModel directly. For group conversations with proper
Group/HashGroup structure, use `ChatPlan.createGroupConversation()` instead.

**Architecture**:
```
Topic (parent object - share this, CHUM syncs the tree)
  → channel (ChannelInfo)
      → participants (HashGroup)
  → group (Group, optional - for group conversations)
```

**Usage Pattern**:
```typescript
import { GroupPlan } from '@chat/core/plans/GroupPlan.js';

const groupPlan = new GroupPlan(topicModel, storageDeps, ownerId);

// Create topic (uses TopicModel internally)
const result = await groupPlan.createTopic({
  topicId: 'topic-123',
  topicName: 'My Conversation',
  participants: [personIdHash1, personIdHash2]
});

// Get participants
const participants = await groupPlan.getTopicParticipants({ topicId: 'topic-123' });
```

### ChatPlan.createGroupConversation

For group conversations with proper Group/HashGroup-based access control:

```typescript
// Creates HashGroup → Group → Topic with proper access grants
const topic = await chatPlan.createGroupConversation('My Group', [person1, person2]);
// CHUM automatically syncs to all participants via HashGroup access
```

## Type Safety

**SHA256Hash and SHA256IdHash**: Branded string types from one.core
- Runtime: Just strings
- Compile-time: Type-safe to prevent mixing hash types
- Never cast these - use helper functions from one.core

## Consuming chat.core

Projects reference via `file:` dependency:

```json
// lama.electron/package.json
{
  "dependencies": {
    "@chat/core": "file:../chat.core",
    "@lama/core": "file:../lama.core",
    "@refinio/one.core": "file:./packages/one.core",
    "@refinio/one.models": "file:./packages/one.models"
  }
}
```

**Runtime behavior**:
1. lama.electron loads its own one.core/one.models instances
2. Creates plan instances: `new ChatPlan(nodeOneCore, stateManager)` (currently ChatHandler)
3. chat.core uses lama.electron's instances (single shared instance)

## Version Synchronization

All projects must use synchronized versions:

```
Current versions (see package.json in each project):
- @refinio/one.core:   0.6.1-beta-3
- @refinio/one.models: 14.1.0-beta-5
```

**When updating**: Update chat.core/packages/ together with lama.core/packages/ and all consuming projects' packages/.

## Related Documentation

- `../ARCHITECTURE-REFACTORING-MINIMAL.md` - Overall refactoring plan
- `../ONECORE-PLAN-AUDIT.md` - Plan classification analysis
- Each consuming project has CLAUDE.md with platform-specific details
