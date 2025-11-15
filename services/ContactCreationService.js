/**
 * Helper functions for creating and updating Someone/Profile objects
 * Used when remote contacts connect via pairing and CHUM
 */
// Import ONE.core functions at the top to avoid dynamic loading issues
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
/**
 * Create a Someone object for a remote person
 * @param {string} personId - The person ID (hash)
 * @param {Object} profileData - Optional profile data (can be null initially)
 * @param {Object} leuteModel - The LeuteModel instance
 * @returns {string} The hash of the created Someone object
 */
export async function createSomeoneObject(personId, profileData, leuteModel) {
    console.log('[ContactCreation] ===== STARTING CONTACT CREATION =====');
    console.log('[ContactCreation] PersonId:', personId?.substring(0, 8) || 'null');
    console.log('[ContactCreation] ProfileData provided:', !!profileData);
    console.log('[ContactCreation] LeuteModel ownerId:', leuteModel?.ownerId?.substring(0, 8) || 'null');
    // Create a minimal placeholder Profile object
    // First create the profile with a temporary profileId to calculate its ID hash
    const tempProfile = {
        $type$: 'Profile',
        profileId: '', // Temporary - will be replaced with actual ID hash
        personId: personId, // The person this profile belongs to
        owner: leuteModel.ownerId || personId, // Who created this profile (us) - NOTE: owner not creatorId
        communicationEndpoint: [], // Will be populated by CHUM sync
        personDescription: [] // Will be populated by CHUM sync
    };
    console.log('[ContactCreation] Created temp profile object:', JSON.stringify(tempProfile, null, 2));
    // Calculate what the ID hash will be
    const profileIdHash = await calculateIdHashOfObj(tempProfile);
    // Now create the real profile with its ID hash as profileId
    const placeholderProfile = {
        $type$: 'Profile',
        profileId: profileIdHash, // The ID hash of this profile object
        personId: personId, // The person this profile belongs to
        owner: leuteModel.ownerId || personId, // Who created this profile (us)
        communicationEndpoint: [], // Will be populated by CHUM sync
        personDescription: [] // Will be populated by CHUM sync
    };
    // Store the placeholder profile - this will create the same hash we calculated
    const profileStoreResult = await storeVersionedObject(placeholderProfile);
    // storeVersionedObject returns {hash, obj} - extract the hash
    const profileHash = profileStoreResult.hash || profileStoreResult;
    console.log('[ContactCreation] Created placeholder profile:', String(profileHash).substring(0, 8));
    // Now create Someone object with the placeholder profile
    const someone = {
        $type$: 'Someone',
        someoneId: personId, // The ID that identifies this Someone
        mainProfile: profileHash, // Reference to the placeholder profile
        identities: new Map([[personId, new Set([profileHash])]]) // Map person to their profiles
    };
    const someoneStoreResult = await storeVersionedObject(someone);
    const someoneHash = someoneStoreResult.hash || someoneStoreResult;
    console.log('[ContactCreation] Created Someone object:', String(someoneHash).substring(0, 8));
    // Use LeuteModel's addSomeoneElse method to add the Someone to the contacts list
    try {
        await leuteModel.addSomeoneElse(someoneHash);
        console.log('[ContactCreation] Added Someone to LeuteModel.other array');
    }
    catch (error) {
        console.log('[ContactCreation] Could not add to LeuteModel.other:', error.message);
    }
    return someoneHash;
}
/**
 * Update an existing Someone object with a received Profile
 * @param {string} personId - The person ID
 * @param {Object} profileObj - The Profile object received via CHUM
 * @param {Object} leuteModel - The LeuteModel instance
 */
export async function updateSomeoneWithProfile(personId, profileObj, leuteModel) {
    console.log('[ContactCreation] Updating Someone with Profile for person:', String(personId).substring(0, 8));
    try {
        // Store the received Profile object locally
        const profileStoreResult = await storeVersionedObject(profileObj);
        const profileHash = profileStoreResult.hash || profileStoreResult;
        console.log('[ContactCreation] Stored received Profile:', String(profileHash).substring(0, 8));
        // Find the Someone object for this person
        const someone = await findSomeoneByPersonId(personId, leuteModel);
        if (someone) {
            // Get the current Someone object data
            const someoneData = await someone.raw();
            // Update with the new Profile as main identity
            const updatedSomeone = {
                $type$: 'Someone',
                someoneId: personId,
                mainProfile: profileHash,
                identities: new Map([[personId, new Set([profileHash])]])
            };
            const newSomeoneHash = await storeVersionedObject(updatedSomeone);
            console.log('[ContactCreation] Updated Someone with Profile as main identity:', String(newSomeoneHash).substring(0, 8));
            // Update the reference in LeuteModel's "other" array
            const me = await leuteModel.me();
            if (me) {
                const currentOthers = await me.other || [];
                const oldHash = someone.idHash;
                // Replace old hash with new hash
                const updatedOthers = currentOthers.map((hash) => hash === oldHash ? newSomeoneHash : hash);
                // Only update if there was a change
                if (updatedOthers.some((h, i) => h !== currentOthers[i])) {
                    const updatedMe = {
                        ...me,
                        other: updatedOthers
                    };
                    await storeVersionedObject(updatedMe);
                    console.log('[ContactCreation] Updated Someone reference in LeuteModel.other');
                }
            }
        }
        else {
            // Someone doesn't exist yet, create it with the Profile
            console.log('[ContactCreation] Someone not found, creating new one with Profile');
            await createSomeoneObject(personId, {
                name: profileObj.name,
                email: profileObj.email
            }, leuteModel);
        }
    }
    catch (error) {
        console.error('[ContactCreation] Error updating Someone with Profile:', error);
        throw error;
    }
}
/**
 * Find a Someone object by person ID
 * Helper to check if Someone already exists
 */
export async function findSomeoneByPersonId(personId, leuteModel) {
    try {
        const others = await leuteModel.others();
        for (const someone of others) {
            // Check the someoneId field
            const someoneId = await someone.someoneId;
            if (someoneId === personId) {
                return someone;
            }
        }
        return null;
    }
    catch (error) {
        console.error('[ContactCreation] Error finding Someone:', error);
        return null;
    }
}
//# sourceMappingURL=ContactCreationService.js.map