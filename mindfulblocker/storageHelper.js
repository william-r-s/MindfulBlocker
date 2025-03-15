/**
 * Storage Helper Utility
 * 
 * This utility provides a consistent interface for storage operations
 * preferring sync storage, but falling back to local storage if needed.
 * 
 * It handles storage limits and errors gracefully.
 */

// Maximum item size for sync storage: 8KB (8192 bytes)
const MAX_SYNC_ITEM_SIZE = 8192;

// Storage interface with fallback
const storage = {
  /**
   * Get items from storage
   * @param {string|string[]|object} keys - Keys to retrieve
   * @returns {Promise<object>} - Retrieved data
   */
  async get(keys) {
    try {
      return await browser.storage.sync.get(keys);
    } catch (error) {
      console.warn('Sync storage get failed, falling back to local storage:', error);
      return await browser.storage.local.get(keys);
    }
  },

  /**
   * Set items in storage
   * @param {object} items - Items to store
   * @returns {Promise<void>}
   */
  async set(items) {
    try {
      // Check if any items exceed the sync storage limit
      const oversizedItems = {};
      const syncSafeItems = {};
      
      for (const [key, value] of Object.entries(items)) {
        const itemJson = JSON.stringify({[key]: value});
        if (itemJson.length > MAX_SYNC_ITEM_SIZE) {
          oversizedItems[key] = value;
        } else {
          syncSafeItems[key] = value;
        }
      }
      
      // Store appropriately sized items in sync storage
      if (Object.keys(syncSafeItems).length > 0) {
        await browser.storage.sync.set(syncSafeItems);
      }
      
      // Store oversized items in local storage
      if (Object.keys(oversizedItems).length > 0) {
        console.warn('Some items exceeded sync storage size limit and were stored in local storage:', 
          Object.keys(oversizedItems));
        await browser.storage.local.set(oversizedItems);
      }
    } catch (error) {
      console.warn('Sync storage set failed, falling back to local storage:', error);
      await browser.storage.local.set(items);
    }
  },

  /**
   * Remove items from storage
   * @param {string|string[]} keys - Keys to remove
   * @returns {Promise<void>}
   */
  async remove(keys) {
    try {
      await browser.storage.sync.remove(keys);
    } catch (error) {
      console.warn('Sync storage remove failed, falling back to local storage:', error);
    }
    
    // Always remove from local storage too in case items were stored there
    await browser.storage.local.remove(keys);
  },

  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await browser.storage.sync.clear();
    } catch (error) {
      console.warn('Sync storage clear failed:', error);
    }
    
    // Always clear local storage too
    await browser.storage.local.clear();
  },

  /**
   * Listen for storage changes
   * @param {function} callback - Called when storage changes
   */
  onChanged: {
    addListener(callback) {
      browser.storage.onChanged.addListener(callback);
    },
    removeListener(callback) {
      browser.storage.onChanged.removeListener(callback);
    }
  },

  /**
   * Perform multiple storage operations in batch
   * @param {Array<{operation: 'get'|'set'|'remove', data: any}>} operations - Array of operations
   * @returns {Promise<Array>} - Results of operations
   */
  async batch(operations) {
    const results = [];
    
    for (const op of operations) {
      try {
        switch (op.operation) {
          case 'get':
            results.push(await this.get(op.data));
            break;
          case 'set':
            await this.set(op.data);
            results.push(true);
            break;
          case 'remove':
            await this.remove(op.data);
            results.push(true);
            break;
          default:
            throw new Error(`Unknown operation: ${op.operation}`);
        }
      } catch (error) {
        console.error(`Batch operation failed:`, error);
        results.push(null);
      }
    }
    
    return results;
  }
};

// Export the storage interface
window.storageHelper = storage; 