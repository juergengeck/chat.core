/**
 * Module augmentation for ONE object types used by chat.core
 *
 * These types are originally defined in one.models/src/recipes/
 * but need to be re-declared here for proper TypeScript resolution.
 *
 * AffirmationCertificate is added to OneUnversionedObjectInterfaces
 * so it works with getAllEntries() type checking.
 */

import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';

// From one.models/src/recipes/Certificates/AffirmationCertificate.ts
export interface AffirmationCertificate {
  $type$: 'AffirmationCertificate';
  data: SHA256Hash;
  license: SHA256Hash;
}

declare module '@OneObjectInterfaces' {
  // Add to OneUnversionedObjectInterfaces so getAllEntries() type checks pass
  export interface OneUnversionedObjectInterfaces {
    AffirmationCertificate: AffirmationCertificate;
  }
}
