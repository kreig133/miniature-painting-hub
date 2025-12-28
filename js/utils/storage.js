/**
 * LocalStorage utility functions
 */

export function saveMyCollection(collection) {
    const collectionData = {
        version: 1,
        data: collection
    };
    localStorage.setItem('myCollection', JSON.stringify(collectionData));
}

export function loadMyCollection() {
    const data = localStorage.getItem('myCollection');
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    // Backward compatibility: if it's an array (old format), migrate it
    if (Array.isArray(parsed)) {
        saveMyCollection(parsed);
        return parsed;
    }
    // New format: return the data array
    return parsed.data || [];
}

export function saveShoppingCart(cart) {
    const cartData = {
        version: 1,
        data: cart
    };
    localStorage.setItem('shoppingCart', JSON.stringify(cartData));
}

export function loadShoppingCart() {
    const data = localStorage.getItem('shoppingCart');
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    // Backward compatibility: if it's an array (old format), migrate it
    if (Array.isArray(parsed)) {
        saveShoppingCart(parsed);
        return parsed;
    }
    // New format: return the data array
    return parsed.data || [];
}

export function saveSortOrder(order) {
    localStorage.setItem('colorSortOrder', order);
}

export function loadSortOrder() {
    return localStorage.getItem('colorSortOrder') || 'hsv';
}


export function savePaletteValueMiddle(value) {
    localStorage.setItem('paletteValueMiddle', value.toString());
}

export function loadPaletteValueMiddle() {
    const value = parseFloat(localStorage.getItem('paletteValueMiddle'));
    return isNaN(value) ? 50 : value;
}

export function savePaletteValueRange(value) {
    localStorage.setItem('paletteValueRange', value.toString());
}

export function loadPaletteValueRange() {
    const value = parseFloat(localStorage.getItem('paletteValueRange'));
    return isNaN(value) ? 100 : value;
}

export function saveCollectionValueMiddle(value) {
    localStorage.setItem('collectionValueMiddle', value.toString());
}

export function loadCollectionValueMiddle() {
    const value = parseFloat(localStorage.getItem('collectionValueMiddle'));
    return isNaN(value) ? 50 : value;
}

export function saveCollectionValueRange(value) {
    localStorage.setItem('collectionValueRange', value.toString());
}

export function loadCollectionValueRange() {
    const value = parseFloat(localStorage.getItem('collectionValueRange'));
    return isNaN(value) ? 100 : value;
}

// Models storage - unified structure
// Structure: { model_id: { model_id, model_name, model_image, pallete_with_mappings, references } }

export function saveModels(models) {
    try {
        const data = JSON.stringify(models);
        // Check size (localStorage typically has ~5-10MB limit)
        const sizeInMB = new Blob([data]).size / (1024 * 1024);
        if (sizeInMB > 4.5) { // Warn if approaching limit
            console.warn(`Models data size: ${sizeInMB.toFixed(2)}MB. Approaching localStorage limit.`);
        }
        localStorage.setItem('models', data);
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('localStorage quota exceeded. Image data is too large. Consider removing some images.');
            alert('Storage limit exceeded. Please remove some images from your models. Images stored as base64 data can quickly fill up browser storage.');
            throw error;
        }
        throw error;
    }
}

export function loadModels() {
    const data = localStorage.getItem('models');
    return data ? JSON.parse(data) : {};
}

export function saveCurrentModelId(modelId) {
    localStorage.setItem('currentModelId', modelId || '');
}

export function loadCurrentModelId() {
    return localStorage.getItem('currentModelId');
}

export function saveUseShoppingColors(useShopping) {
    localStorage.setItem('useShoppingColors', useShopping ? 'true' : 'false');
}

export function loadUseShoppingColors() {
    return localStorage.getItem('useShoppingColors') === 'true';
}

export function saveModelsPanelWidth(width) {
    localStorage.setItem('modelsPanelWidth', width.toString());
}

export function loadModelsPanelWidth() {
    const width = localStorage.getItem('modelsPanelWidth');
    return width ? parseInt(width, 10) : 300;
}

