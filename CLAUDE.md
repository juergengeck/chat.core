# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# chat.core

Platform-agnostic chat/messaging business logic for LAMA applications.

## Build Commands

```bash
# Compile TypeScript (compiles to same directory as source)
npm run build

# Watch mode for development
npm run watch

# Clean generated JS/map files (preserves packages/ and node_modules/)
npm run clean
```

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
  chat.core handlers use injected dependencies
  Result: Single shared instance across entire app
```

**Package Structure**:
- `packages/` - Build-time type definitions only (never bundled)
- Compiled JS output is co-located with source files (no `dist/` or `build/`)

### Directory Structure

```
chat.core/
├── handlers/              # Pure business logic handlers
│   ├── ChatHandler.ts         # Message/conversation operations
│   ├── ContactsHandler.ts     # Contact management
│   ├── ExportHandler.ts       # Export/import operations
│   ├── IOMHandler.ts          # Internet of Me integration
│   └── FeedForwardHandler.ts  # Feed forward operations
├── services/              # Reusable service layer
│   ├── ContactService.ts      # Contact queries with AI detection
│   └── ProfileService.ts      # Profile/avatar management
├── models/                # Domain models
│   └── TopicGroupManager.ts
├── cache/                 # Caching implementations
│   ├── OneObjectCache.ts
│   ├── RawChannelEntriesCache.ts
│   ├── ChatAttachmentCache.ts
│   └── BlobDescriptorCache.ts
├── types/                 # Custom type definitions
│   └── AvatarPreference.ts
└── packages/              # Build-time only (git-ignored symlinks)
    ├── one.core/
    └── one.models/
```

### Handler Pattern (Dependency Injection)

All handlers follow this pattern:

```typescript
export class ChatHandler {
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
- Handlers are transport-agnostic (work in Electron IPC, Web Workers, etc)
- All dependencies injected via constructor
- Methods accept typed request objects, return typed response objects
- No direct imports of platform-specific code

### Services vs Handlers

**Handlers**: RPC-style interfaces for transport layers (IPC, Workers)
- Request/Response pattern
- Transport-agnostic
- Examples: ChatHandler, ContactsHandler

**Services**: Reusable business logic components
- Direct method calls
- Used by handlers or directly by platforms
- Examples: ContactService (with AI detection, caching), ProfileService

## Scope Boundaries

### ✅ What IS in chat.core

Chat-specific business logic that:
- Builds on one.models foundation
- Adds LAMA-specific chat features
- Is platform-agnostic
- Is NOT AI-related (that's lama.core)

**Contents**:
- Chat/messaging operations (ChatHandler)
- Contact management with AI detection (ContactService, ContactsHandler)
- Topic/conversation management (TopicGroupManager)
- Profile and avatar management (ProfileService)
- Export/import operations (ExportHandler)
- Internet of Me integration (IOMHandler)
- Feed forward (FeedForwardHandler)
- Caching utilities (OneObjectCache, etc.)

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

### Caching Layer

**OneObjectCache**: Generic object caching with event notifications
- Type-safe caching for ONE objects
- `onUpdate` and `onError` events
- Runtime type checking
- Used by RawChannelEntriesCache, ChatAttachmentCache, BlobDescriptorCache

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
2. Creates handler instances: `new ChatHandler(nodeOneCore, stateManager)`
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
- `../ONECORE-HANDLER-AUDIT.md` - Handler classification analysis
- Each consuming project has CLAUDE.md with platform-specific details
