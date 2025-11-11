/**
 * Contact Service (Chat Business Logic)
 *
 * Extracted from OneCoreHandler - chat-specific contact management.
 * Provides contact list with LAMA-specific enhancements:
 * - AI contact detection
 * - Avatar color management
 * - No caching (LeuteModel already caches)
 * - Deduplication
 */
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
// Type guards
function isEmail(obj) {
    return obj.$type$ === 'Email';
}
// Avatar color generation
function generateAvatarColor(personId) {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6',
        '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'
    ];
    let hash = 0;
    for (let i = 0; i < personId.length; i++) {
        hash = ((hash << 5) - hash) + personId.charCodeAt(i);
        hash = hash & hash;
    }
    return colors[Math.abs(hash) % colors.length];
}
function getMoodColor(mood) {
    const moodColors = {
        'happy': '#f59e0b', 'sad': '#3b82f6', 'angry': '#ef4444',
        'calm': '#14b8a6', 'excited': '#ec4899', 'tired': '#8b5cf6',
        'focused': '#10b981', 'neutral': '#6366f1'
    };
    return moodColors[mood] || moodColors['neutral'];
}
async function getAvatarColor(personId) {
    try {
        const result = await getObjectByIdHash(personId);
        if (result && result.obj) {
            const pref = result.obj;
            if (pref.mood)
                return getMoodColor(pref.mood);
            if (pref.color)
                return pref.color;
        }
    }
    catch (e) {
        // Preference doesn't exist, will create one
    }
    const color = generateAvatarColor(personId);
    const preference = {
        $type$: 'AvatarPreference',
        personId,
        color,
        updatedAt: Date.now()
    };
    try {
        await storeVersionedObject(preference);
    }
    catch (e) {
        console.warn('[ContactService] Failed to store avatar preference:', e);
    }
    return color;
}
/**
 * ContactService - Contact management with LAMA-specific features
 */
export class ContactService {
    leuteModel;
    aiAssistantModel; // Optional - for AI detection
    // No local cache - LeuteModel already caches
    constructor(leuteModel, aiAssistantModel) {
        this.leuteModel = leuteModel;
        this.aiAssistantModel = aiAssistantModel;
    }
    /**
     * Invalidate contacts cache (deprecated - no-op)
     */
    invalidateContactsCache() {
        // No-op - we don't cache locally
    }
    /**
     * Get contacts from LeuteModel with LAMA-specific enhancements
     */
    async getContacts() {
        console.log('\n' + '='.repeat(60));
        console.log('[ContactService] 📋 GETTING CONTACTS - START');
        console.log('='.repeat(60));
        const contacts = [];
        // Get owner ID
        let myId = null;
        try {
            const me = await this.leuteModel.me();
            myId = await me.mainIdentity();
        }
        catch (error) {
            console.warn('[ContactService] Error getting owner ID:', error);
        }
        // Get ALL contacts from LeuteModel.others()
        console.log('[ContactService] Step 1: Calling LeuteModel.others()...');
        const others = await this.leuteModel.others();
        console.log(`[ContactService] ✅ LeuteModel.others() returned ${others.length} contacts`);
        // Track processed personIds to avoid duplicates
        const processedPersonIds = new Set();
        // Process contacts
        for (const someone of others) {
            try {
                const personId = await someone.mainIdentity();
                if (!personId || processedPersonIds.has(personId)) {
                    continue;
                }
                processedPersonIds.add(personId);
                const profile = await someone.mainProfile();
                // Extract email
                let email = null;
                if (someone.email) {
                    email = someone.email;
                }
                else if (profile?.communicationEndpoints?.length > 0) {
                    const emailEndpoint = profile.communicationEndpoints.find(isEmail);
                    if (emailEndpoint && 'email' in emailEndpoint) {
                        email = emailEndpoint.email;
                    }
                }
                else if (typeof someone.mainEmail === 'function') {
                    try {
                        email = await someone.mainEmail();
                    }
                    catch (e) {
                        // mainEmail might not exist or fail
                    }
                }
                // Check if AI contact and get model ID
                let isAI = false;
                let modelId = undefined;
                if (this.aiAssistantModel?.llmObjectManager) {
                    isAI = this.aiAssistantModel.llmObjectManager.isLLMPerson(personId);
                    // If it's an AI contact, try to get its model ID
                    if (isAI) {
                        modelId = this.aiAssistantModel.llmObjectManager.getModelIdForPerson(personId);
                    }
                }
                if (!isAI && email && email.endsWith('@ai.local')) {
                    isAI = true;
                }
                // Get display name
                let displayName = null;
                if (profile) {
                    try {
                        const personNames = profile.descriptionsOfType('PersonName');
                        if (personNames && personNames.length > 0) {
                            displayName = personNames[0].name;
                        }
                    }
                    catch (e) {
                        console.log(`[ContactService] Error getting PersonName: ${e.message}`);
                    }
                }
                // Extract name from AI email if needed
                if (displayName === 'Unknown Contact' && email && isAI) {
                    const emailPrefix = email.split('@')[0];
                    displayName = emailPrefix
                        .replace(/lmstudio_/g, '')
                        .replace(/ollama_/g, '')
                        .replace(/claude_/g, '')
                        .replace(/_/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    if (email.includes('lmstudio')) {
                        displayName += ' (LM Studio)';
                    }
                    else if (email.includes('ollama')) {
                        displayName += ' (Ollama)';
                    }
                }
                // Fallback display name
                if (!displayName) {
                    displayName = personId ? `Contact ${String(personId).substring(0, 8)}` : 'Unknown Contact';
                }
                // Check if owner
                const isOwner = personId === myId;
                if (isOwner) {
                    displayName += ' (You)';
                }
                // Get avatar color
                const color = await getAvatarColor(personId);
                contacts.push({
                    id: personId,
                    personId: personId,
                    someoneId: someone.idHash,
                    name: displayName,
                    displayName: displayName,
                    email: email || `${String(personId).substring(0, 8)}@lama.network`,
                    isAI: isAI,
                    modelId: modelId, // Include model ID for AI contacts
                    role: isOwner ? 'owner' : 'contact',
                    platform: isAI ? 'ai' : (isOwner ? 'nodejs' : 'external'),
                    status: isOwner ? 'owner' : 'offline',
                    isConnected: isOwner ? true : false,
                    trusted: true,
                    lastSeen: new Date().toISOString(),
                    color
                });
            }
            catch (error) {
                console.warn('[ContactService] Error processing contact:', error);
            }
        }
        console.log('\n[ContactService] SUMMARY:');
        console.log(`[ContactService]   - Total from LeuteModel.others(): ${others.length}`);
        console.log(`[ContactService]   - After deduplication: ${contacts.length}`);
        console.log(`[ContactService]   - Owner: ${contacts.filter(c => c.role === 'owner').length}`);
        console.log(`[ContactService]   - AI contacts: ${contacts.filter(c => c.isAI).length}`);
        console.log(`[ContactService]   - Regular contacts: ${contacts.filter(c => !c.isAI && c.role !== 'owner').length}`);
        console.log('='.repeat(60) + '\n');
        return contacts;
    }
    /**
     * Get peer list (simplified contact format)
     */
    async getPeerList() {
        console.log('[ContactService] Getting peer list');
        try {
            const contacts = await this.getContacts();
            return contacts.map((contact) => ({
                id: contact.id,
                personId: contact.personId,
                name: contact.name,
                displayName: contact.displayName,
                email: contact.email,
                isAI: contact.isAI,
                status: contact.status || 'offline',
                isConnected: contact.isConnected || false
            }));
        }
        catch (error) {
            console.error('[ContactService] Failed to get peer list:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=ContactService.js.map