/**
 * Application state management
 */

import { loadPalette, loadMyCollection, loadShoppingCart, loadSortOrder, loadSaturationThreshold, loadSelectedColorSaturationThreshold, 
         loadPaletteValueMiddle, loadPaletteValueRange, 
         loadCollectionValueMiddle, loadCollectionValueRange,
         loadPalettes, loadCurrentPaletteId, saveCurrentPaletteId } from '../utils/storage.js';

// Application state
export const state = {
    // Current selected color
    currentColor: null,
    
    // Multiple palettes
    palettes: {}, // Object: { paletteId: { id, name, colors: [] } }
    currentPaletteId: null,
    
    // Current palette (derived from currentPaletteId)
    palette: [],
    
    // My Collection
    myCollection: [],
    
    // Shopping cart
    shoppingCart: [],
    
    // Sort order
    sortOrder: 'hsv',
    
    // Saturation threshold
    saturationThreshold: 90,
    selectedColorSaturationThreshold: 90, // For Palette Editor
    
    // Color wheel settings
    paletteValueMiddle: 50,
    paletteValueRange: 100,
    collectionValueMiddle: 50,
    collectionValueRange: 100,
    
    // Canvas context
    ctx: null,
    
    // Color wheel variables
    colorWheelCanvas: null,
    colorWheelCtx: null,
    colorWheelCenterX: 0,
    colorWheelCenterY: 0,
    colorWheelRadius: 0,
    palettePointPositions: [],
    
    // Collection wheel variables
    collectionWheelCanvas: null,
    collectionWheelCtx: null,
    collectionWheelCenterX: 0,
    collectionWheelCenterY: 0,
    collectionWheelRadius: 0,
    collectionPointPositions: [],
    
    // Paint colors wheel variables
    paintColorsWheelCanvas: null,
    paintColorsWheelCtx: null,
    paintColorsWheelCenterX: 0,
    paintColorsWheelCenterY: 0,
    paintColorsWheelRadius: 0,
    paintColorsPointPositions: [],
    paintColorsValueMiddle: 50,
    paintColorsValueRange: 100,
    
    // Merged paint colors
    mergedPaintColors: []
};

// Initialize state from localStorage
export function initState() {
    // Load multiple palettes
    state.palettes = loadPalettes();
    state.currentPaletteId = loadCurrentPaletteId();
    
    // If no palettes exist, create a default one
    if (!state.palettes || Object.keys(state.palettes).length === 0) {
        const defaultId = 'palette_' + Date.now();
        state.palettes = {
            [defaultId]: {
                id: defaultId,
                name: 'Palette 1',
                colors: []
            }
        };
        state.currentPaletteId = defaultId;
    }
    
    // If currentPaletteId doesn't exist or is invalid, use the first one
    if (!state.currentPaletteId || !state.palettes[state.currentPaletteId]) {
        const paletteKeys = Object.keys(state.palettes);
        if (paletteKeys.length > 0) {
            state.currentPaletteId = paletteKeys[0];
        }
    }
    
    // Set current palette from palettes - make sure we have a valid reference
    if (state.currentPaletteId && state.palettes[state.currentPaletteId]) {
        const paletteColors = state.palettes[state.currentPaletteId].colors;
        state.palette = Array.isArray(paletteColors) ? [...paletteColors] : [];
    } else {
        state.palette = [];
    }
    
    // Save current palette ID if it was missing
    if (state.currentPaletteId) {
        saveCurrentPaletteId(state.currentPaletteId);
    }
    
    state.myCollection = loadMyCollection();
    state.shoppingCart = loadShoppingCart();
    state.sortOrder = loadSortOrder();
    state.saturationThreshold = loadSaturationThreshold();
    state.selectedColorSaturationThreshold = loadSelectedColorSaturationThreshold();
    state.paletteValueMiddle = loadPaletteValueMiddle();
    state.paletteValueRange = loadPaletteValueRange();
    state.collectionValueMiddle = loadCollectionValueMiddle();
    state.collectionValueRange = loadCollectionValueRange();
    
    // Initialize canvas context
    const imageCanvas = document.getElementById('imageCanvas');
    if (imageCanvas) {
        state.ctx = imageCanvas.getContext('2d');
    }
}

// Getters
export function getCurrentColor() {
    return state.currentColor;
}

export function getPalette() {
    return state.palette;
}

export function getMyCollection() {
    return state.myCollection;
}

export function getShoppingCart() {
    return state.shoppingCart;
}

export function setShoppingCart(cart) {
    state.shoppingCart = cart;
}

export function getMergedPaintColors() {
    return state.mergedPaintColors;
}

// Setters
export function setCurrentColor(color) {
    state.currentColor = color;
}

export function setPalette(palette) {
    // Create a copy to avoid reference issues
    state.palette = Array.isArray(palette) ? [...palette] : [];
    // Also update the current palette in palettes object
    if (state.currentPaletteId && state.palettes[state.currentPaletteId]) {
        state.palettes[state.currentPaletteId].colors = Array.isArray(palette) ? [...palette] : [];
    }
}

export function getCurrentPaletteId() {
    return state.currentPaletteId;
}

export function setCurrentPaletteId(paletteId) {
    if (state.palettes && state.palettes[paletteId]) {
        state.currentPaletteId = paletteId;
        // Create a copy of the colors array to avoid reference issues
        const paletteColors = state.palettes[paletteId].colors;
        state.palette = Array.isArray(paletteColors) ? [...paletteColors] : [];
    }
}

export function getPalettes() {
    return state.palettes;
}

export function setPalettes(palettes) {
    state.palettes = palettes;
}

export function addPalette(paletteId, paletteData) {
    state.palettes[paletteId] = paletteData;
}

export function removePalette(paletteId) {
    delete state.palettes[paletteId];
}

export function setMyCollection(collection) {
    state.myCollection = collection;
}

export function setMergedPaintColors(colors) {
    state.mergedPaintColors = colors;
}

export function setSortOrder(order) {
    state.sortOrder = order;
}

export function setSaturationThreshold(threshold) {
    state.saturationThreshold = threshold;
}

export function setSelectedColorSaturationThreshold(threshold) {
    state.selectedColorSaturationThreshold = threshold;
}

