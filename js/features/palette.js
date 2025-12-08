/**
 * Palette management feature
 */

import { rgbToHSV, generateSplitGradient } from '../utils/colorUtils.js';
import { savePalette as savePaletteToStorage } from '../utils/storage.js';
import { state, setPalette, getPalette } from '../core/state.js';

let paletteGrid = null;
let clearPaletteBtn = null;
let drawPalettePointsOnWheel = null; // Will be set by colorWheel module
let updateClosestMatches = null; // Will be set by main
let updatePlanningTable = null; // Will be set by main

// Initialize palette module
export function initPalette(dependencies = {}) {
    paletteGrid = document.getElementById('paletteGrid');
    clearPaletteBtn = document.getElementById('clearPaletteBtn');
    
    if (dependencies.drawPalettePointsOnWheel) {
        drawPalettePointsOnWheel = dependencies.drawPalettePointsOnWheel;
    }
    if (dependencies.updateClosestMatches) {
        updateClosestMatches = dependencies.updateClosestMatches;
    }
    if (dependencies.updatePlanningTable) {
        updatePlanningTable = dependencies.updatePlanningTable;
    }
    
    // Clear palette button handler
    if (clearPaletteBtn) {
        clearPaletteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your entire palette?')) {
                setPalette([]);
                savePalette();
                loadPalette();
                
                // Update planning table
                if (updatePlanningTable) {
                    updatePlanningTable();
                }
                // Update closest matches when palette is cleared
                if (state.currentColor) {
                    if (updateClosestMatches) {
                        updateClosestMatches();
                    }
                }
            }
        });
    }
}

// Load palette from state and display
export function loadPalette() {
    if (!paletteGrid) return;
    
    paletteGrid.innerHTML = '';
    const palette = getPalette();
    
    if (palette.length === 0) {
        paletteGrid.innerHTML = '<p class="empty-message">No colors saved yet. Upload an image and start picking!</p>';
        if (clearPaletteBtn) {
            clearPaletteBtn.style.display = 'none';
        }
        if (drawPalettePointsOnWheel) {
            drawPalettePointsOnWheel(); // Clear points if palette is empty
        }
        return;
    }
    
    if (clearPaletteBtn) {
        clearPaletteBtn.style.display = 'block';
    }
    
    palette.forEach((color, index) => {
        const item = createPaletteItem(color, index);
        paletteGrid.appendChild(item);
    });
    
    if (drawPalettePointsOnWheel) {
        drawPalettePointsOnWheel(); // Draw palette points on color wheel
    }
}

// Create palette item element
function createPaletteItem(color, index) {
    const item = document.createElement('div');
    item.className = 'palette-item';
    
    const colorDiv = document.createElement('div');
    colorDiv.className = 'palette-color';
    colorDiv.style.backgroundColor = color.hex;
    
    item.innerHTML = `
        <div class="palette-info">
            <div class="palette-hex">${color.hex.toUpperCase()}</div>
            <div class="palette-rgb">rgb(${color.r}, ${color.g}, ${color.b})</div>
        </div>
        <button class="palette-delete" data-index="${index}">×</button>
    `;
    
    // Insert color div at the beginning
    item.insertBefore(colorDiv, item.firstChild);
    
    // Store original color for restoration
    const originalColor = color.hex;
    
    // Click to show gradient
    item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('palette-delete') && !e.target.classList.contains('palette-copy')) {
            const gradient = generateSplitGradient(originalColor, color.r, color.g, color.b);
            colorDiv.style.backgroundImage = gradient;
            colorDiv.style.backgroundSize = '100% 50%, 100% 50%';
            colorDiv.style.backgroundPosition = 'top, bottom';
            colorDiv.style.backgroundRepeat = 'no-repeat';
        }
    });
    
    // Mouse leave to restore original color
    item.addEventListener('mouseleave', () => {
        colorDiv.style.backgroundImage = '';
        colorDiv.style.backgroundSize = '';
        colorDiv.style.backgroundPosition = '';
        colorDiv.style.backgroundRepeat = '';
        colorDiv.style.backgroundColor = originalColor;
    });
    
    // Double click to copy hex
    item.addEventListener('dblclick', (e) => {
        if (!e.target.classList.contains('palette-delete')) {
            navigator.clipboard.writeText(color.hex.toUpperCase()).then(() => {
                const hexEl = item.querySelector('.palette-hex');
                const originalText = hexEl.textContent;
                hexEl.textContent = 'Copied!';
                setTimeout(() => {
                    hexEl.textContent = originalText;
                }, 1000);
            });
        }
    });
    
    // Delete button
    const deleteBtn = item.querySelector('.palette-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const palette = getPalette();
        palette.splice(index, 1);
        // Re-sort palette after deletion to maintain order
        const sortedPalette = sortPaletteByHSV(palette, state.sortOrder);
        setPalette(sortedPalette);
        savePalette();
        loadPalette();
        
        // Update planning table
        if (updatePlanningTable) {
            updatePlanningTable();
        }
        // Update closest matches when palette changes
        if (state.currentColor) {
            if (updateClosestMatches) {
                updateClosestMatches();
            }
        }
    });
    
    return item;
}

// Save palette to localStorage
export function savePalette() {
    savePaletteToStorage(getPalette());
}

// Sort palette using HSV color space (Hue, Saturation, Value)
export function sortPaletteByHSV(colors, sortOrder = 'hsv') {
    if (colors.length <= 1) return colors;
    
    // Convert colors to include HSV values and sort
    const colorsWithHSV = colors.map(color => ({
        ...color,
        hsv: rgbToHSV(color.r, color.g, color.b)
    }));
    
    // Define sort order based on parameter
    // sortOrder is a string like 'hsv', 'hvs', 'shv', etc.
    const order = sortOrder.toLowerCase();
    
    colorsWithHSV.sort((a, b) => {
        // Helper function to compare two HSV values based on order
        const compare = (val1, val2, reverse = false) => {
            const diff = val1 - val2;
            // Use threshold to avoid floating point precision issues
            if (Math.abs(diff) > 0.01) {
                return reverse ? -diff : diff;
            }
            return null; // Values are equal
        };
        
        // Primary sort
        let result = null;
        if (order[0] === 'h') {
            result = compare(a.hsv.h, b.hsv.h);
        } else if (order[0] === 's') {
            result = compare(a.hsv.s, b.hsv.s, true); // Higher saturation first
        } else if (order[0] === 'v') {
            result = compare(a.hsv.v, b.hsv.v, true); // Higher value first
        }
        if (result !== null) return result;
        
        // Secondary sort
        if (order[1] === 'h') {
            result = compare(a.hsv.h, b.hsv.h);
        } else if (order[1] === 's') {
            result = compare(a.hsv.s, b.hsv.s, true);
        } else if (order[1] === 'v') {
            result = compare(a.hsv.v, b.hsv.v, true);
        }
        if (result !== null) return result;
        
        // Tertiary sort
        if (order[2] === 'h') {
            result = compare(a.hsv.h, b.hsv.h);
        } else if (order[2] === 's') {
            result = compare(a.hsv.s, b.hsv.s, true);
        } else if (order[2] === 'v') {
            result = compare(a.hsv.v, b.hsv.v, true);
        }
        return result !== null ? result : 0;
    });
    
    // Return colors without HSV property
    return colorsWithHSV.map(({ hsv, ...color }) => color);
}

// Add color to palette
export function addColorToPalette(color) {
    const palette = getPalette();
    const exists = palette.some(c => c.hex === color.hex);
    
    if (!exists) {
        palette.push(color);
        const sortedPalette = sortPaletteByHSV(palette, state.sortOrder);
        setPalette(sortedPalette);
        savePalette();
        loadPalette();
        return true;
    }
    return false;
}

