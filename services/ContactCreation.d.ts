/**
 * Contact creation helper - creates Profile and Someone objects for remote contacts
 * Platform-agnostic - works in both browser and Node.js
 */
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import { type SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
/**
 * Creates a Profile and Someone object for a Person ID
 */
export declare function createProfileAndSomeoneForPerson(personId: SHA256IdHash<any>, leuteModel: LeuteModel, profileOptions?: {
    displayName?: string;
    descriptors?: any[];
}): Promise<any>;
/**
 * Ensures a contact exists for a Person ID - creates if needed
 */
export declare function ensureContactExists(personId: SHA256IdHash<any>, leuteModel: LeuteModel, profileOptions?: {
    displayName?: string;
    descriptors?: any[];
}): Promise<any>;
/**
 * Handle Profile data received via CHUM
 * The Profile has already been stored by ONE.core CHUM sync - we just need to create Someone
 */
export declare function handleReceivedProfile(personId: SHA256IdHash<any>, profileData: any, leuteModel: LeuteModel): Promise<void>;
//# sourceMappingURL=ContactCreation.d.ts.map