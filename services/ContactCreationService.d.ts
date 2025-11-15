/**
 * Helper functions for creating and updating Someone/Profile objects
 * Used when remote contacts connect via pairing and CHUM
 */
/**
 * Create a Someone object for a remote person
 * @param {string} personId - The person ID (hash)
 * @param {Object} profileData - Optional profile data (can be null initially)
 * @param {Object} leuteModel - The LeuteModel instance
 * @returns {string} The hash of the created Someone object
 */
export declare function createSomeoneObject(personId: any, profileData: any, leuteModel: any): Promise<any>;
/**
 * Update an existing Someone object with a received Profile
 * @param {string} personId - The person ID
 * @param {Object} profileObj - The Profile object received via CHUM
 * @param {Object} leuteModel - The LeuteModel instance
 */
export declare function updateSomeoneWithProfile(personId: any, profileObj: any, leuteModel: any): Promise<any>;
/**
 * Find a Someone object by person ID
 * Helper to check if Someone already exists
 */
export declare function findSomeoneByPersonId(personId: any, leuteModel: any): Promise<any>;
//# sourceMappingURL=ContactCreationService.d.ts.map