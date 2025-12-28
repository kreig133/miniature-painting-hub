/**
 * Application state management
 */

import { loadMyCollection, loadShoppingCart, loadSortOrder, 
         loadPaletteValueMiddle, loadPaletteValueRange, 
         loadCollectionValueMiddle, loadCollectionValueRange,
         loadModels, loadCurrentModelId, saveCurrentModelId, saveModels } from '../utils/storage.js';
import { generateUUID } from '../utils/uuid.js';

// Application state
export const state = {
    // Current selected color
    currentColor: null,
    
    // Models: { model_id: { model_id, model_name, model_image, pallete_with_mappings, references } }
    models: {},
    currentModelId: null,
    
    // My Collection
    myCollection: [],
    
    // Shopping cart
    shoppingCart: [],
    
    // Planning mode: 'edit' or 'view'
    planningMode: 'edit',
    
    // Sort order
    sortOrder: 'hsv',
    
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
    // Load models
    state.models = loadModels();
    state.currentModelId = loadCurrentModelId();
    
    // If no models exist, create a default one
    if (!state.models || Object.keys(state.models).length === 0) {
        const defaultId = 'model_' + generateUUID();
        state.models = {
            [defaultId]: {
                model_id: defaultId,
                model_name: 'Model 1',
                model_image: null,
                pallete_with_mappings: {},
                references: []
            }
        };
        state.currentModelId = defaultId;
        saveModels(state.models);
        saveCurrentModelId(defaultId);
    } else {
        // If currentModelId doesn't exist or is invalid, use the first one
        if (!state.currentModelId || !state.models[state.currentModelId]) {
            const modelKeys = Object.keys(state.models);
            if (modelKeys.length > 0) {
                state.currentModelId = modelKeys[0];
                saveCurrentModelId(state.currentModelId);
            }
        }
    }
    
    state.myCollection = loadMyCollection();
    state.shoppingCart = loadShoppingCart();
    state.sortOrder = loadSortOrder();
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

// Get current model's palette (colors from pallete_with_mappings)
export function getPalette() {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return [];
    }
    const model = state.models[state.currentModelId];
    return Object.values(model.pallete_with_mappings).map(item => item.color);
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

// Get current model's palette with mappings
export function getPalleteWithMappings() {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return {};
    }
    return state.models[state.currentModelId].pallete_with_mappings;
}

// Get mapping for a specific color
export function getColorMapping(colorHex) {
    const mappings = getPalleteWithMappings();
    return mappings[colorHex]?.mapping || null;
}

export function getPlanningMode() {
    return state.planningMode;
}

// Callbacks for planning mode changes
let planningModeChangeCallbacks = [];

export function setPlanningMode(mode) {
    const oldMode = state.planningMode;
    
    // Only update and notify if mode actually changed
    if (oldMode !== mode) {
        state.planningMode = mode;
        
        // Notify all subscribers
        planningModeChangeCallbacks.forEach(callback => {
            try {
                callback(mode, oldMode);
            } catch (error) {
                console.error('Error in planning mode change callback:', error);
            }
        });
    }
}

export function onPlanningModeChange(callback) {
    if (typeof callback === 'function') {
        planningModeChangeCallbacks.push(callback);
    }
}

export function offPlanningModeChange(callback) {
    planningModeChangeCallbacks = planningModeChangeCallbacks.filter(cb => cb !== callback);
}

export function getMergedPaintColors() {
    return state.mergedPaintColors;
}

// Setters
export function setCurrentColor(color) {
    state.currentColor = color;
}

// Get current model ID
export function getCurrentModelId() {
    return state.currentModelId;
}

// Set current model ID
export function setCurrentModelId(modelId) {
    if (state.models && state.models[modelId]) {
        state.currentModelId = modelId;
        saveCurrentModelId(modelId);
    }
}

// Get all models
export function getModels() {
    return state.models;
}

// Set all models
export function setModels(models) {
    state.models = models;
    saveModels(models);
}

// Get current model
export function getCurrentModel() {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return null;
    }
    return state.models[state.currentModelId];
}

// Add a new model
export function addModel(modelId, modelData) {
    state.models[modelId] = modelData;
    try {
        saveModels(state.models);
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('Failed to save model: storage quota exceeded');
            return;
        }
        throw error;
    }
}

// Remove a model
export function removeModel(modelId) {
    delete state.models[modelId];
    try {
        saveModels(state.models);
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('Failed to save after removing model: storage quota exceeded');
            return;
        }
        throw error;
    }
}

// Update current model
export function updateCurrentModel(updates) {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return;
    }
    Object.assign(state.models[state.currentModelId], updates);
    try {
        saveModels(state.models);
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            // Revert the changes since save failed
            console.error('Failed to save model: storage quota exceeded');
            // Don't revert Object.assign since we can't easily undo it
            // The user will need to remove some images
            return;
        }
        throw error;
    }
}

// Add color to current model's palette
export function addColorToPalette(color) {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return;
    }
    const model = state.models[state.currentModelId];
    if (!model.pallete_with_mappings[color.hex]) {
        model.pallete_with_mappings[color.hex] = {
            color: { ...color },
            mapping: null
        };
        try {
            saveModels(state.models);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('Failed to save color: storage quota exceeded');
                return;
            }
            throw error;
        }
    }
}

// Remove color from current model's palette
export function removeColorFromPalette(colorHex) {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return;
    }
    const model = state.models[state.currentModelId];
    if (model.pallete_with_mappings[colorHex]) {
        delete model.pallete_with_mappings[colorHex];
        try {
            saveModels(state.models);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('Failed to save after removing color: storage quota exceeded');
                return;
            }
            throw error;
        }
    }
}

// Set mapping for a color in current model
export function setColorMapping(colorHex, mapping) {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return;
    }
    const model = state.models[state.currentModelId];
    if (model.pallete_with_mappings[colorHex]) {
        model.pallete_with_mappings[colorHex].mapping = mapping;
        try {
            saveModels(state.models);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('Failed to save mapping: storage quota exceeded');
                return;
            }
            throw error;
        }
    }
}

// Remove mapping for a color in current model
export function removeColorMapping(colorHex) {
    if (!state.currentModelId || !state.models[state.currentModelId]) {
        return;
    }
    const model = state.models[state.currentModelId];
    if (model.pallete_with_mappings[colorHex]) {
        model.pallete_with_mappings[colorHex].mapping = null;
        try {
            saveModels(state.models);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('Failed to save after removing mapping: storage quota exceeded');
                return;
            }
            throw error;
        }
    }
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


