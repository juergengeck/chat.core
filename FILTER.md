# CHUM Object Filtering System

## Overview

The CHUM (Content-Hash Update Mechanism) synchronization protocol supports bidirectional object filtering to control what data is shared between peers. This document describes the two-way filtering architecture that enables secure, selective data synchronization.

## Architecture

### Two-Way Filtering

**1. Outbound Filtering (`objectFilter`)**
- **Purpose**: Controls what objects we SEND to peers
- **Use Case**: Selective sharing of sensitive data (Groups, Access policies)
- **Location**: CHUM Exporter (packages/one.core/src/chum-exporter-service.ts)

**2. Inbound Filtering (`importFilter`)**
- **Purpose**: Controls what objects we ACCEPT from peers
- **Use Case**: Defense against malicious data injection
- **Location**: CHUM Importer (packages/one.core/src/chum-importer-exporterclient.ts)

## Default Behavior

### Without Custom Filters

**Outbound (objectFilter = undefined):**
- Group objects: NOT shared
- Access/IdAccess objects: NOT shared
- All other objects: Shared normally

**Inbound (importFilter = undefined):**
- Group objects: REJECTED
- Access/IdAccess objects: REJECTED
- All other objects: Accepted normally

This default behavior prevents unauthorized access policy modification and maintains security.

### With Custom Filters

When filters are provided, they completely override the default behavior for their respective direction.

## Implementation

### one.core Layer

Provides the filtering mechanism:

```typescript
// chum-sync.ts
export interface ChumSyncOptions {
    // ... other options
    objectFilter?: (hash: SHA256Hash | SHA256IdHash, type: string) => Promise<boolean>;
    importFilter?: (hash: SHA256Hash | SHA256IdHash, type: string) => Promise<boolean>;
}
```

**Exporter (chum-exporter-service.ts):**
```typescript
private async getAccessibleRoots(): Promise<string> {
    const result = JSON.stringify(
        await getAccessibleRootHashes(this.remotePersonId, this.objectFilter)
    );
    return result;
}
```

**Importer (chum-importer-exporterclient.ts):**
```typescript
// In fetchObject()
if (this.importFilter) {
    const allowed = await this.importFilter(hash, obj.$type$);
    if (!allowed) {
        throw createError('CIEC-FO3', {obj, reason: 'importFilter rejected'});
    }
} else {
    // Default: reject Access, IdAccess, Group
    if (REJECTED_TYPES.has(obj.$type$)) {
        throw createError('CIEC-FO3', {obj});
    }
}
```

### one.models Layer

Passes filters through to CHUM protocol:

```typescript
// ConnectionsModel.ts
export type ConnectionsModelConfiguration = {
    // ... other config

    // Outbound: What we send to peers
    objectFilter?: (hash: SHA256Hash | SHA256IdHash, type: string) => Promise<boolean>;

    // Inbound: What we accept from peers
    importFilter?: (hash: SHA256Hash | SHA256IdHash, type: string) => Promise<boolean>;
};
```

**Usage:**
```typescript
await startChumProtocol(
    conn,
    localPersonId,
    localInstanceId,
    remotePersonId,
    remoteInstanceId,
    initiatedLocally,
    connectionRoutesGroupName,
    this.onProtocolStart,
    this.config.noImport,
    this.config.noExport,
    this.config.objectFilter,   // Outbound filter
    this.config.importFilter    // Inbound filter
);
```

### Application Layer

Implements filter logic based on business requirements.

## Security Model

### Correct Flow

1. **Share Certificates** via trust.core/one.trust
   - Exchange public keys and signing certificates
   - Establish cryptographic identity

2. **Establish Trust Relationships**
   - Mark certificates as trusted
   - Build trust graph

3. **Configure Filters**
   - Set up validation based on trusted certificates
   - Define acceptance criteria

4. **Secure Synchronization**
   - Objects with valid signatures from trusted parties: Accepted
   - Objects without signatures or from untrusted sources: Rejected

### Why Two Filters?

**objectFilter (Outbound):**
- Privacy: Don't leak sensitive data
- Compliance: Only share what's authorized
- Efficiency: Reduce bandwidth for irrelevant data

**importFilter (Inbound):**
- Security: Prevent malicious injection
- Integrity: Validate authenticity
- Policy enforcement: Ensure data meets requirements

## Example: Group Synchronization

### Problem

Groups need to be shared securely:
- Must validate the group creator's identity
- Must verify cryptographic signatures
- Must prevent malicious group injection

### Solution

**Outbound Filter:**
```typescript
const objectFilter = async (hash, type) => {
    if (type === 'Group') {
        // Check if we created this group or trust the creator
        const signatures = await getSignatures(hash);
        if (signatures.length === 0) return false;

        // Validate signature from trusted member
        for (const sig of signatures) {
            if (await isTrustedMember(sig.issuer)) {
                if (await verifySignature(sig)) {
                    return true;
                }
            }
        }
        return false;
    }
    return true; // Allow other types
};
```

**Inbound Filter:**
```typescript
const importFilter = async (hash, type) => {
    // SECURITY: Never accept access policy modifications from peers
    if (type === 'Access' || type === 'IdAccess') {
        return false;
    }

    // For Groups: validate signatures
    if (type === 'Group') {
        const signatures = await getSignatures(hash);
        if (signatures.length === 0) return false;

        // Must be signed by a member we trust
        for (const sig of signatures) {
            if (await isTrustedMember(sig.issuer)) {
                if (await verifySignature(sig)) {
                    return true;
                }
            }
        }
        return false;
    }

    return true; // Allow other validated types
};
```

## Best Practices

### 1. Always Use importFilter for Security-Sensitive Applications

```typescript
// BAD: Relies only on default behavior
connectionsModelConfig: {
    objectFilter  // Only outbound
}

// GOOD: Explicit inbound validation
connectionsModelConfig: {
    objectFilter,  // What we send
    importFilter   // What we accept (CRITICAL)
}
```

### 2. Validate Signatures

```typescript
// BAD: Trust without verification
if (type === 'Group') {
    return true;  // Accept all groups
}

// GOOD: Cryptographic validation
if (type === 'Group') {
    const signatures = await getSignatures(hash);
    return await hasValidSignatureFromTrustedSource(signatures);
}
```

### 3. Fail Closed

```typescript
// BAD: Allow by default
const importFilter = async (hash, type) => {
    if (type === 'MaliciousType') return false;
    return true;  // Everything else allowed
};

// GOOD: Explicit allowlist
const importFilter = async (hash, type) => {
    // Default deny
    if (type === 'Access' || type === 'IdAccess') return false;

    // Explicit validation for sensitive types
    if (type === 'Group') {
        return await validateGroup(hash);
    }

    // Other types: explicit allow
    return true;
};
```

### 4. Log Rejections for Debugging

```typescript
const importFilter = async (hash, type) => {
    if (type === 'Access') {
        console.log(`[importFilter] Rejected ${type} ${hash.substring(0,8)} (security policy)`);
        return false;
    }

    if (type === 'Group') {
        const valid = await validateGroup(hash);
        if (!valid) {
            console.log(`[importFilter] Rejected Group ${hash.substring(0,8)} (invalid signature)`);
        }
        return valid;
    }

    return true;
};
```

## Attack Scenarios

### 1. Malicious Access Policy Injection

**Attack:** Adversary sends Access object granting them permissions

**Defense:**
```typescript
const importFilter = async (hash, type) => {
    // NEVER accept Access/IdAccess from peers
    if (type === 'Access' || type === 'IdAccess') {
        return false;
    }
    return true;
};
```

### 2. Forged Group Objects

**Attack:** Adversary creates fake Group with legitimate members

**Defense:**
```typescript
const importFilter = async (hash, type) => {
    if (type === 'Group') {
        // Require valid cryptographic signature
        const signatures = await getSignatures(hash);
        for (const sig of signatures) {
            // Check: Is signer trusted?
            if (!await isTrusted(sig.issuer)) continue;

            // Check: Is signature valid?
            if (!await verifySignature(sig)) continue;

            return true;
        }
        return false; // No valid signatures
    }
    return true;
};
```

### 3. Replay Attacks

**Attack:** Adversary replays old valid objects

**Defense:** Use timestamps and version tracking in filter logic:
```typescript
const importFilter = async (hash, type) => {
    if (type === 'Group') {
        const group = await getObject(hash);

        // Check if we already have a newer version
        const existing = await getLatestVersion(group.id);
        if (existing && existing.timestamp > group.timestamp) {
            return false; // Reject old version
        }

        return await validateSignatures(hash);
    }
    return true;
};
```

## Testing

### Verify Filters Are Active

```typescript
// Test that objectFilter is called
const objectFilterCalled = [];
const objectFilter = async (hash, type) => {
    objectFilterCalled.push({hash, type});
    return true;
};

// Test that importFilter is called
const importFilterCalled = [];
const importFilter = async (hash, type) => {
    importFilterCalled.push({hash, type});
    return true;
};

// After sync
assert(objectFilterCalled.length > 0, 'objectFilter was called');
assert(importFilterCalled.length > 0, 'importFilter was called');
```

### Verify Rejection Works

```typescript
const importFilter = async (hash, type) => {
    if (type === 'Access') return false;
    return true;
};

// Send Access object
// Verify it's NOT stored on receiving peer
const exists = await objectExists(accessObjectHash);
assert(!exists, 'Access object was rejected');
```

## References

- **one.core**: `packages/one.core/src/chum-sync.ts`
- **one.models**: `packages/one.models/src/models/ConnectionsModel.ts`
- **Protocol**: `packages/one.models/src/misc/ConnectionEstablishment/protocols/Chum.ts`
- **GitHub Issue**: https://github.com/refinio/one.core/issues/86

## Version History

- **v0.6.1-beta-3**: Initial outbound objectFilter support
- **v0.6.1-beta-4**: Added inbound importFilter support
