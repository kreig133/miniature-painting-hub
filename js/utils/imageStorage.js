/**
 * Image storage using IndexedDB for large image data
 * Stores images separately from models to avoid localStorage quota issues
 */

const DB_NAME = 'ColorWheelApp';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let db = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

// Save image to IndexedDB
export async function saveImage(imageData) {
    try {
        const database = await initDB();
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.put(imageData);
            request.onsuccess = () => resolve(imageData.id);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error saving image to IndexedDB:', error);
        throw error;
    }
}

// Get image from IndexedDB
export async function getImage(imageId) {
    if (!imageId) return null;
    
    try {
        const database = await initDB();
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(imageId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting image from IndexedDB:', error);
        return null;
    }
}

// Delete image from IndexedDB
export async function deleteImage(imageId) {
    if (!imageId) return;
    
    try {
        const database = await initDB();
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(imageId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error deleting image from IndexedDB:', error);
        throw error;
    }
}

// Get multiple images by IDs
export async function getImages(imageIds) {
    if (!imageIds || imageIds.length === 0) return [];
    
    try {
        const database = await initDB();
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        const promises = imageIds.map(id => {
            return new Promise((resolve) => {
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
        });
        
        const results = await Promise.all(promises);
        return results.filter(img => img !== null);
    } catch (error) {
        console.error('Error getting images from IndexedDB:', error);
        return [];
    }
}

