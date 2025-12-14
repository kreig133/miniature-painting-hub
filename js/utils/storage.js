/**
 * LocalStorage utility functions
 */

export function savePalette(palette) {
    localStorage.setItem('colorPalette', JSON.stringify(palette));
}

export function loadPalette() {
    const data = localStorage.getItem('colorPalette');
    return data ? JSON.parse(data) : [];
}

export function saveMyCollection(collection) {
    localStorage.setItem('myCollection', JSON.stringify(collection));
}

export function loadMyCollection() {
    const data = localStorage.getItem('myCollection');
    return data ? JSON.parse(data) : [];
}

export function saveShoppingCart(cart) {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
}

export function loadShoppingCart() {
    const data = localStorage.getItem('shoppingCart');
    return data ? JSON.parse(data) : [];
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

// Multiple palettes storage
export function savePalettes(palettes) {
    localStorage.setItem('palettes', JSON.stringify(palettes));
}

export function loadPalettes() {
    const data = localStorage.getItem('palettes');
    if (data) {
        return JSON.parse(data);
    }
    
    // Migration: if old single palette exists, convert it
    const oldPalette = loadPalette();
    if (oldPalette && oldPalette.length > 0) {
        const defaultId = 'palette_1';
        const palettes = {
            [defaultId]: {
                id: defaultId,
                name: 'Palette 1',
                colors: oldPalette
            }
        };
        savePalettes(palettes);
        // Keep old palette for backward compatibility
        return palettes;
    }
    
    return {};
}

export function saveCurrentPaletteId(paletteId) {
    localStorage.setItem('currentPaletteId', paletteId);
}

export function loadCurrentPaletteId() {
    return localStorage.getItem('currentPaletteId');
}

export function saveUseShoppingColors(useShopping) {
    localStorage.setItem('useShoppingColors', useShopping ? 'true' : 'false');
}

export function loadUseShoppingColors() {
    return localStorage.getItem('useShoppingColors') === 'true';
}

// Planning mappings: { paletteId: { colorHex: { candidate1: {...}, candidate2: {...}, fromAll: {...} } } }
export function savePlanningMappings(mappings) {
    localStorage.setItem('planningMappings', JSON.stringify(mappings));
}

export function loadPlanningMappings() {
    const data = localStorage.getItem('planningMappings');
    return data ? JSON.parse(data) : {};
}

// Model images storage (stored per palette)
export function saveModelImages(paletteId, images) {
    const key = `modelImages_${paletteId}`;
    localStorage.setItem(key, JSON.stringify(images));
}

export function loadModelImages(paletteId) {
    const key = `modelImages_${paletteId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

export function saveModelImageId(paletteId, imageId) {
    localStorage.setItem(`modelImageId_${paletteId}`, imageId || '');
}

export function loadModelImageId(paletteId) {
    return localStorage.getItem(`modelImageId_${paletteId}`) || null;
}

export function saveModelsPanelWidth(width) {
    localStorage.setItem('modelsPanelWidth', width.toString());
}

export function loadModelsPanelWidth() {
    const width = localStorage.getItem('modelsPanelWidth');
    return width ? parseInt(width, 10) : 300;
}

