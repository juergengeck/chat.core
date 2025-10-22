import type {SHA256Hash} from '@refinio/one.core/lib/util/type-checks.js';
import {OEvent} from '@refinio/one.models/lib/misc/OEvent.js';
import type {BlobDescriptor} from '@refinio/one.models/lib/models/BlobCollectionModel.js';
import BlobCollectionModel from '@refinio/one.models/lib/models/BlobCollectionModel.js';
import type {BlobDescriptor as OneBlobDescriptor} from '@refinio/one.models/lib/recipes/BlobRecipes.js';
import {BlobDescriptorRecipe} from '@refinio/one.models/lib/recipes/BlobRecipes.js';
import {getObject} from '@refinio/one.core/lib/storage-unversioned-objects.js';

/**
 * This cache caches BlobDescriptors
 *
 * This is necessary, because on rerender of chat messages we do not want to load BlobDescriptors again. This would take too
 * much time because we would have to load them and the browser would have to decode them again.
 */
export default class BlobDescriptorCache {
    public onUpdate = new OEvent<() => void>();
    public onError = new OEvent<(error: any) => void>();

    private isInitialized = true;
    private cache = new Map<SHA256Hash<OneBlobDescriptor>, BlobDescriptor | undefined>();

    /**
     * Cleanup the instance.
     *
     * After this function is called this class cannot be reused.
     */
    public shutdown() {
        this.isInitialized = false;
        this.cache.clear();
    }

    /**
     * Get the BlobDescriptor synchronously or return the hash.
     *
     * @param hash used for getting the OneBlobDescriptor and as key for the cache
     * @param obj Optional. can skip getting OneBlobDescriptor by hash if provided
     * @returns if undefined BlobDescriptor is still loading
     */
    public query(
        hash: SHA256Hash<OneBlobDescriptor>,
        obj?: OneBlobDescriptor
    ): BlobDescriptor | undefined {
        this.assertInitialized();

        if (!this.cache.has(hash)) {
            this.monitor(hash, obj);
            return undefined;
        }

        return this.cache.get(hash);
    }

    /**
     * Loads asynchronously and emits onUpdate event when it is done.
     *
     * For the moment nothing is monitored after the blob is loaded. This API was intended for versioned objects, where
     * the versioned object is monitored for new version.
     *
     * @param hash
     */
    private monitor(hash: SHA256Hash<OneBlobDescriptor>, obj?: OneBlobDescriptor): void {
        this.assertInitialized();

        if (this.cache.has(hash)) {
            return;
        }

        // Set to undefined, so that the previous 'if' prevents other monitor calls to also load the same info.
        this.cache.set(hash, undefined);

        (async () => {
            const blobDescriptor =
                obj === undefined
                    ? await BlobDescriptorCache.loadByHash(hash)
                    : await BlobDescriptorCache.loadByObject(obj);
            if (blobDescriptor) {
                this.cache.set(hash, blobDescriptor);
                this.onUpdate.emit();
            }
        })().catch(e => this.onError.emit(e));
    }

    /**
     * Load the BlobDescriptor by OneBlobDescriptor if available
     *
     * @private
     * @param object
     */
    private static async loadByObject(
        object: OneBlobDescriptor
    ): Promise<BlobDescriptor | undefined> {
        if (object.$type$ === BlobDescriptorRecipe.name) {
            return await BlobCollectionModel.resolveBlobDescriptor(object);
        }
        return undefined;
    }

    /**
     * Load the BlobDescriptor by OneBlobDescriptor if available
     *
     * @param hash
     * @private
     */
    private static async loadByHash(
        hash: SHA256Hash<OneBlobDescriptor>
    ): Promise<BlobDescriptor | undefined> {
        const object = await getObject(hash);
        return BlobDescriptorCache.loadByObject(object);
    }

    private assertInitialized() {
        if (!this.isInitialized) {
            throw new Error(
                'BlobDescriptorCache: You cannot use any method of this class, because it is already shut down.'
            );
        }
    }
}
