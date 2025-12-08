/**
 * Application state management
 */

import { loadPalette, loadMyCollection, loadSortOrder, loadSaturationThreshold, 
         loadPaletteValueMiddle, loadPaletteValueRange, 
         loadCollectionValueMiddle, loadCollectionValueRange } from '../utils/storage.js';

// Application state
export const state = {
    // Current selected color
    currentColor: null,
    
    // Palette
    palette: [],
    
    // My Collection
    myCollection: [],
    
    // Sort order
    sortOrder: 'hsv',
    
    // Saturation threshold
    saturationThreshold: 90,
    
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
    
    // Merged paint colors
    mergedPaintColors: []
};

// Initialize state from localStorage
export function initState() {
    state.palette = loadPalette();
    state.myCollection = loadMyCollection();
    state.sortOrder = loadSortOrder();
    state.saturationThreshold = loadSaturationThreshold();
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

export function getMergedPaintColors() {
    return state.mergedPaintColors;
}

// Setters
export function setCurrentColor(color) {
    state.currentColor = color;
}

export function setPalette(palette) {
    state.palette = palette;
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

