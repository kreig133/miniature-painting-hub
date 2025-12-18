/**
 * Planning feature - color matching and planning table
 */

import { rgbToHSV, hsvDistance, addGradientClickToColorBox, hexToRgb, hsvToRGB, rgbToHex, ciede2000Distance } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import { state, getPalette, getMyCollection, getMergedPaintColors, getCurrentPaletteId, getPlanningMappings, setPlanningMappings, getPlanningMode, setPlanningMode, getShoppingCart, onPlanningModeChange } from '../core/state.js';
import { updateHeaderCount, getEffectiveMyCollection } from './myCollection.js';
import { filterData } from './filters.js';
import { savePlanningMappings } from '../utils/storage.js';

// Dependencies
let saveSortOrder = null;
let setSortOrder = null;
let sortPaletteByHSV = null;
let savePalette = null;
let loadPalette = null;
let addToShoppingCart = null;
let addColorToPalette = null;

// Find closest color from merged paint colors
export function findClosestColor(targetColor, source = 'merged', filterContainerId = null) {
    let dataSource = null;
    const mergedPaintColors = getMergedPaintColors();
    
    // Use merged data source
    if (source === 'merged' || !source) {
        if (!mergedPaintColors || mergedPaintColors.length === 0) {
            return null;
        }
        dataSource = mergedPaintColors;
        
        // Apply filters if filter container ID is provided
        if (filterContainerId) {
            dataSource = filterData(dataSource, filterContainerId);
        }
    } else {
        // Legacy support for old source names
        return null; // Simplified - only support merged
    }

    // Convert target color to HSV
    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    // Use selectedColorSaturationThreshold if called from Palette Editor, otherwise use saturationThreshold
    const threshold = (filterContainerId === 'selectedColorFilters') ? state.selectedColorSaturationThreshold : state.saturationThreshold;
    const thresholdValue = targetSaturation * (threshold / 100);

    let closestMatch = null;
    let minDistance = Infinity;

    // First pass: try to find match with saturation filter
    dataSource.forEach(item => {
        // Convert hex to RGB
        const rgb = hexToRgb(item.hex);
        if (!rgb) return;
        const { r, g, b } = rgb;

        // Convert candidate color to HSV
        const candidateHSV = rgbToHSV(r, g, b);
        
        // Ignore colors with saturation less than threshold percentage of target saturation
        if (candidateHSV.s < thresholdValue) {
            return; // Skip this color
        }

        // Calculate distance in HSV color space
        const distance = hsvDistance(targetHSV, candidateHSV);

        if (distance < minDistance) {
            minDistance = distance;
            closestMatch = item;
        }
    });

    // If no match found with saturation filter, try without filter
    if (closestMatch === null) {
        minDistance = Infinity;
        
        dataSource.forEach(item => {
            const rgb = hexToRgb(item.hex);
            if (!rgb) return;
            const { r, g, b } = rgb;

            const candidateHSV = rgbToHSV(r, g, b);
            const distance = hsvDistance(targetHSV, candidateHSV);

            if (distance < minDistance) {
                minDistance = distance;
                closestMatch = item;
            }
        });
    }

    return closestMatch;
}

// Find Nth closest color
export function findNthClosestColor(targetColor, n, source = 'merged', filterContainerId = null) {
    let dataSource = null;
    const mergedPaintColors = getMergedPaintColors();
    
    if (source === 'merged' || !source) {
        if (!mergedPaintColors || mergedPaintColors.length === 0) {
            return null;
        }
        dataSource = mergedPaintColors;
        
        if (filterContainerId) {
            dataSource = filterData(dataSource, filterContainerId);
        }
    } else {
        return null;
    }

    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    // Use selectedColorSaturationThreshold if called from Palette Editor, otherwise use saturationThreshold
    const threshold = (filterContainerId === 'selectedColorFilters') ? state.selectedColorSaturationThreshold : state.saturationThreshold;
    const thresholdValue = targetSaturation * (threshold / 100);

    const matches = [];
    
    // First pass: try to find matches with saturation filter
    dataSource.forEach(item => {
        const rgb = hexToRgb(item.hex);
        if (!rgb) return;
        const { r, g, b } = rgb;

        const candidateHSV = rgbToHSV(r, g, b);
        
        if (candidateHSV.s < thresholdValue) {
            return;
        }

        const distance = hsvDistance(targetHSV, candidateHSV);
        matches.push({ item, distance });
    });

    // If no matches found with saturation filter, try without filter
    if (matches.length === 0) {
        dataSource.forEach(item => {
            const rgb = hexToRgb(item.hex);
            if (!rgb) return;
            const { r, g, b } = rgb;

            const candidateHSV = rgbToHSV(r, g, b);
            const distance = hsvDistance(targetHSV, candidateHSV);
            matches.push({ item, distance });
        });
    }

    // Sort by distance and return the Nth closest
    matches.sort((a, b) => a.distance - b.distance);
    return matches.length >= n ? matches[n - 1].item : null;
}

// Find closest from Paint Colors (wrapper for findClosestColor)
export function findClosestFromPaintColors(targetColor, filterContainerId = null) {
    return findClosestColor(targetColor, 'merged', filterContainerId);
}

// Find closest from my collection
export function findClosestFromMyCollection(targetColor, filterContainerId = null) {
    const myCollection = getEffectiveMyCollection();
    if (!myCollection || myCollection.length === 0) {
        return null;
    }

    let dataSource = myCollection;
    if (filterContainerId) {
        dataSource = filterData(myCollection, filterContainerId);
        if (dataSource.length === 0) {
            return null;
        }
    }

    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    // Use selectedColorSaturationThreshold if called from Palette Editor, otherwise use saturationThreshold
    const threshold = (filterContainerId === 'selectedColorFilters') ? state.selectedColorSaturationThreshold : state.saturationThreshold;
    const thresholdValue = targetSaturation * (threshold / 100);

    let closestMatch = null;
    let minDistance = Infinity;

    dataSource.forEach(item => {
        const rgb = hexToRgb(item.hex);
        if (!rgb) return;
        const { r, g, b } = rgb;

        const candidateHSV = rgbToHSV(r, g, b);
        
        if (candidateHSV.s < thresholdValue) {
            return;
        }

        const distance = hsvDistance(targetHSV, candidateHSV);

        if (distance < minDistance) {
            minDistance = distance;
            closestMatch = item;
        }
    });

    if (closestMatch === null) {
        minDistance = Infinity;
        
        dataSource.forEach(item => {
            const rgb = hexToRgb(item.hex);
            if (!rgb) return;
            const { r, g, b } = rgb;

            const candidateHSV = rgbToHSV(r, g, b);
            const distance = hsvDistance(targetHSV, candidateHSV);

            if (distance < minDistance) {
                minDistance = distance;
                closestMatch = item;
            }
        });
    }

    return closestMatch;
}

// Find Nth closest from my collection
export function findNthClosestFromMyCollection(targetColor, n, filterContainerId = null) {
    const myCollection = getEffectiveMyCollection();
    if (!myCollection || myCollection.length === 0) {
        return null;
    }

    let dataSource = myCollection;
    if (filterContainerId) {
        dataSource = filterData(myCollection, filterContainerId);
        if (dataSource.length === 0) {
            return null;
        }
    }

    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    // Use selectedColorSaturationThreshold if called from Palette Editor, otherwise use saturationThreshold
    const threshold = (filterContainerId === 'selectedColorFilters') ? state.selectedColorSaturationThreshold : state.saturationThreshold;
    const thresholdValue = targetSaturation * (threshold / 100);

    const matches = [];
    
    dataSource.forEach(item => {
        const rgb = hexToRgb(item.hex);
        if (!rgb) return;
        const { r, g, b } = rgb;

        const candidateHSV = rgbToHSV(r, g, b);
        
        if (candidateHSV.s < thresholdValue) {
            return;
        }

        const distance = hsvDistance(targetHSV, candidateHSV);
        matches.push({ item, distance });
    });

    if (matches.length === 0) {
        dataSource.forEach(item => {
            const rgb = hexToRgb(item.hex);
            if (!rgb) return;
            const { r, g, b } = rgb;

            const candidateHSV = rgbToHSV(r, g, b);
            const distance = hsvDistance(targetHSV, candidateHSV);
            matches.push({ item, distance });
        });
    }

    matches.sort((a, b) => a.distance - b.distance);
    return matches.length >= n ? matches[n - 1].item : null;
}

// Find closest from palette
// useSelectedColorThreshold: true for Palette Editor, false for Planning tab
export function findClosestFromPalette(targetColor, useSelectedColorThreshold = false) {
    const palette = getPalette();
    if (!palette || palette.length === 0) {
        return null;
    }

    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    // Use selectedColorSaturationThreshold if called from Palette Editor, otherwise use saturationThreshold
    const threshold = useSelectedColorThreshold ? state.selectedColorSaturationThreshold : state.saturationThreshold;
    const thresholdValue = targetSaturation * (threshold / 100);

    let closestMatch = null;
    let minDistance = Infinity;

    palette.forEach(item => {
        let r, g, b;
        if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
            r = item.r;
            g = item.g;
            b = item.b;
        } else {
            const rgb = hexToRgb(item.hex);
            if (!rgb) return;
            r = rgb.r;
            g = rgb.g;
            b = rgb.b;
        }

        const candidateHSV = rgbToHSV(r, g, b);
        
        if (candidateHSV.s < thresholdValue) {
            return;
        }

        const distance = hsvDistance(targetHSV, candidateHSV);

        if (distance < minDistance) {
            minDistance = distance;
            closestMatch = item;
        }
    });

    if (closestMatch === null) {
        minDistance = Infinity;
        
        palette.forEach(item => {
            let r, g, b;
            if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
                r = item.r;
                g = item.g;
                b = item.b;
            } else {
                const rgb = hexToRgb(item.hex);
                if (!rgb) return;
                r = rgb.r;
                g = rgb.g;
                b = rgb.b;
            }

            const candidateHSV = rgbToHSV(r, g, b);
            const distance = hsvDistance(targetHSV, candidateHSV);

            if (distance < minDistance) {
                minDistance = distance;
                closestMatch = item;
            }
        });
    }

    return closestMatch;
}

// Find Nth closest from palette
// useSelectedColorThreshold: true for Palette Editor, false for Planning tab
export function findNthClosestFromPalette(targetColor, n, useSelectedColorThreshold = false) {
    const palette = getPalette();
    if (!palette || palette.length === 0) {
        return null;
    }

    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    // Use selectedColorSaturationThreshold if called from Palette Editor, otherwise use saturationThreshold
    const threshold = useSelectedColorThreshold ? state.selectedColorSaturationThreshold : state.saturationThreshold;
    const thresholdValue = targetSaturation * (threshold / 100);

    const matches = [];
    
    palette.forEach(item => {
        let r, g, b;
        if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
            r = item.r;
            g = item.g;
            b = item.b;
        } else {
            const rgb = hexToRgb(item.hex);
            if (!rgb) return;
            r = rgb.r;
            g = rgb.g;
            b = rgb.b;
        }

        const candidateHSV = rgbToHSV(r, g, b);
        
        if (candidateHSV.s < thresholdValue) {
            return;
        }

        const distance = hsvDistance(targetHSV, candidateHSV);
        matches.push({ item, distance });
    });

    if (matches.length === 0) {
        palette.forEach(item => {
            let r, g, b;
            if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
                r = item.r;
                g = item.g;
                b = item.b;
            } else {
                const rgb = hexToRgb(item.hex);
                if (!rgb) return;
                r = rgb.r;
                g = rgb.g;
                b = rgb.b;
            }

            const candidateHSV = rgbToHSV(r, g, b);
            const distance = hsvDistance(targetHSV, candidateHSV);
            matches.push({ item, distance });
        });
    }

    matches.sort((a, b) => a.distance - b.distance);
    return matches.length >= n ? matches[n - 1].item : null;
}

// Helper functions for mappings
function getMapping(colorHex) {
    const paletteId = getCurrentPaletteId();
    const mappings = getPlanningMappings();
    if (!paletteId || !mappings || !mappings[paletteId]) {
        return null;
    }
    return mappings[paletteId][colorHex] || null;
}

function saveMapping(colorHex, type, paint) {
    const paletteId = getCurrentPaletteId();
    if (!paletteId) return;
    
    const mappings = getPlanningMappings();
    if (!mappings[paletteId]) {
        mappings[paletteId] = {};
    }
    if (!mappings[paletteId][colorHex]) {
        mappings[paletteId][colorHex] = {};
    }
    
    // Only one assignment is allowed per palette color
    // Clear all other assignments (candidate1, candidate2, fromAll, mixingScheme)
    delete mappings[paletteId][colorHex].candidate1;
    delete mappings[paletteId][colorHex].candidate2;
    delete mappings[paletteId][colorHex].fromAll;
    delete mappings[paletteId][colorHex].mixingScheme;
    
    // Set the new assignment
    mappings[paletteId][colorHex][type] = paint;
    setPlanningMappings(mappings);
    savePlanningMappings(mappings);
}

function removeMapping(colorHex) {
    const paletteId = getCurrentPaletteId();
    if (!paletteId) return;
    
    const mappings = getPlanningMappings();
    if (mappings[paletteId] && mappings[paletteId][colorHex]) {
        delete mappings[paletteId][colorHex];
        setPlanningMappings(mappings);
        savePlanningMappings(mappings);
    }
}

function countMappings(colorHex) {
    const mapping = getMapping(colorHex);
    if (!mapping) return 0;
    let count = 0;
    if (mapping.candidate1) count++;
    if (mapping.candidate2) count++;
    if (mapping.fromAll) count++;
    if (mapping.mixingScheme) count++;
    return count;
}

function getAssignedPaint(mapping) {
    if (!mapping) return null;
    return mapping.candidate1 || mapping.candidate2 || mapping.fromAll || null;
}

function isInMyCollection(paint) {
    if (!paint) return false;
    const myCollection = getMyCollection();
    return myCollection.some(c => c.hex === paint.hex && c.name === paint.name && c.producer === paint.producer);
}

function isInShoppingList(paint) {
    if (!paint) return false;
    const shoppingCart = getShoppingCart();
    return shoppingCart.some(c => c.hex === paint.hex && c.name === paint.name && c.producer === paint.producer);
}

export function saveMixingScheme(colorHex, mixingScheme) {
    const paletteId = getCurrentPaletteId();
    if (!paletteId) return;
    
    const mappings = getPlanningMappings();
    if (!mappings[paletteId]) {
        mappings[paletteId] = {};
    }
    if (!mappings[paletteId][colorHex]) {
        mappings[paletteId][colorHex] = {};
    }
    
    // Remove existing paint mappings when saving mixing scheme
    delete mappings[paletteId][colorHex].candidate1;
    delete mappings[paletteId][colorHex].candidate2;
    delete mappings[paletteId][colorHex].fromAll;
    
    mappings[paletteId][colorHex].mixingScheme = mixingScheme;
    setPlanningMappings(mappings);
    savePlanningMappings(mappings);
}

// Load planning table
export function loadPlanningTable(preserveMode = false) {
    const planningTable = document.getElementById('planningTable');
    if (!planningTable) return;

    const tbody = planningTable.querySelector('tbody');
    if (!tbody) return;

    const thead = planningTable.querySelector('thead tr');
    
    // Update table headers based on current mode (always read fresh)
    if (thead) {
        const currentMode = getPlanningMode(); // Read fresh mode
        if (currentMode === 'view') {
            thead.innerHTML = `
                <th>
                    <div class="table-header-with-controls">
                        <span>Color</span>
                        <select id="sortOrderSelectPlanning" class="sort-order-select">
                            <option value="hsv">Hue-Saturation-Value</option>
                            <option value="hvs">Hue-Value-Saturation</option>
                            <option value="shv">Saturation-Hue-Value</option>
                            <option value="svh">Saturation-Value-Hue</option>
                            <option value="vhs">Value-Hue-Saturation</option>
                            <option value="vsh">Value-Saturation-Hue</option>
                        </select>
                    </div>
                </th>
                <th>Mapping</th>
            `;
            // Re-initialize sort order select if it exists
            const sortSelect = document.getElementById('sortOrderSelectPlanning');
            if (sortSelect && setSortOrder) {
                sortSelect.value = state.sortOrder || 'hsv';
            }
        } else {
            thead.innerHTML = `
                <th>
                    <div class="table-header-with-controls">
                        <span>Color</span>
                        <select id="sortOrderSelectPlanning" class="sort-order-select">
                            <option value="hsv">Hue-Saturation-Value</option>
                            <option value="hvs">Hue-Value-Saturation</option>
                            <option value="shv">Saturation-Hue-Value</option>
                            <option value="svh">Saturation-Value-Hue</option>
                            <option value="vhs">Value-Hue-Saturation</option>
                            <option value="vsh">Value-Saturation-Hue</option>
                        </select>
                    </div>
                </th>
                <th>Candidate 1</th>
                <th>Candidate 2</th>
                <th>From All</th>
                <th>Manual</th>
            `;
            // Re-initialize sort order select if it exists
            const sortSelect = document.getElementById('sortOrderSelectPlanning');
            if (sortSelect && setSortOrder) {
                sortSelect.value = state.sortOrder || 'hsv';
                sortSelect.addEventListener('change', (e) => {
                    if (setSortOrder) setSortOrder(e.target.value);
                    if (saveSortOrder) saveSortOrder(e.target.value);
                    if (sortPaletteByHSV && loadPalette) {
                        const palette = getPalette();
                        const sorted = sortPaletteByHSV(palette, e.target.value);
                        loadPalette();
                    }
                    updatePlanningTable();
                });
            }
        }
    }

    function updatePlanningTable() {
        // Always read the current mode, don't rely on closure
        const currentMode = getPlanningMode();
        
        tbody.innerHTML = '';

        const palette = getPalette();
        if (palette.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = currentMode === 'view' ? 2 : 5;
            cell.textContent = 'No colors in palette yet. Add colors from the Color Picker tab.';
            row.appendChild(cell);
            tbody.appendChild(row);
            updateHeaderCount('planningHeader', 0, 0);
            const modeToggleBtn = document.getElementById('planningModeToggleBtn');
            if (modeToggleBtn) modeToggleBtn.style.display = 'none';
            return;
        }
        
        updateHeaderCount('planningHeader', palette.length, palette.length);
        
        // Show/hide filter container based on mode
        const filterContainer = document.getElementById('planningFilters');
        if (filterContainer) {
            filterContainer.style.display = currentMode === 'view' ? 'none' : 'block';
        }

        if (currentMode === 'view') {
            // View mode: show Color and Mapping columns
            palette.forEach(color => {
                const row = document.createElement('tr');
                
                // Color column
                const colorCell = document.createElement('td');
                const colorBox = document.createElement('div');
                colorBox.className = 'color-box';
                colorBox.style.backgroundColor = color.hex;
                addGradientClickToColorBox(colorBox, color.hex);
                addHoverTooltipToColorBox(colorBox);
                colorCell.appendChild(colorBox);
                row.appendChild(colorCell);
                
                // Mapping column
                const mapping = getMapping(color.hex);
                const mappingCell = createViewModeMappingCell(mapping, color.hex, updatePlanningTable);
                row.appendChild(mappingCell);
                
                tbody.appendChild(row);
            });
        } else {
            // Edit mode: show all columns with candidates
            palette.forEach(color => {
                const row = document.createElement('tr');
                const mapping = getMapping(color.hex);
                
                // Color column
                const colorCell = document.createElement('td');
                const colorBox = document.createElement('div');
                colorBox.className = 'color-box';
                colorBox.style.backgroundColor = color.hex;
                addGradientClickToColorBox(colorBox, color.hex);
                addHoverTooltipToColorBox(colorBox);
                colorCell.appendChild(colorBox);
                row.appendChild(colorCell);
                
                // Candidate 1
                const candidate1Match = findClosestFromMyCollection(color, 'planningFilters');
                const candidate1Cell = createEditModeCandidateCell(candidate1Match, () => {
                    if (candidate1Match) {
                        saveMapping(color.hex, 'candidate1', candidate1Match);
                        updatePlanningTable();
                    }
                }, mapping?.candidate1 ? 'candidate1' : null, mapping);
                row.appendChild(candidate1Cell);
                
                // Candidate 2
                const candidate2Match = findNthClosestFromMyCollection(color, 2, 'planningFilters');
                const candidate2Cell = createEditModeCandidateCell(candidate2Match, () => {
                    if (candidate2Match) {
                        saveMapping(color.hex, 'candidate2', candidate2Match);
                        updatePlanningTable();
                    }
                }, mapping?.candidate2 ? 'candidate2' : null, mapping);
                row.appendChild(candidate2Cell);
                
                // From All
                const fromAllMatch = findClosestFromPaintColors(color, 'planningFilters');
                const fromAllCell = createEditModeFromAllCell(fromAllMatch, color, mapping);
                row.appendChild(fromAllCell);
                
                // Manual (Mixing)
                const mixingCell = createEditModeMixingCell(color, candidate1Match, candidate2Match, fromAllMatch, mapping);
                row.appendChild(mixingCell);
                
                tbody.appendChild(row);
            });
        }
    }
    
    // Helper function to create view mode mapping cell
    function createViewModeMappingCell(mapping, paletteColorHex, updateCallback) {
        const cell = document.createElement('td');
        
        const assignedPaint = getAssignedPaint(mapping);
        const mixingScheme = mapping?.mixingScheme;
        
        if (assignedPaint || (mixingScheme && mixingScheme.resultHex)) {
            const container = document.createElement('div');
            container.className = 'candidate-container';
            container.style.position = 'relative';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            
            if (assignedPaint) {
                // Show assigned paint
                const paintColorBox = document.createElement('div');
                paintColorBox.className = 'color-box';
                paintColorBox.style.backgroundColor = assignedPaint.hex;
                paintColorBox.style.position = 'relative';
                addGradientClickToColorBox(paintColorBox, assignedPaint.hex);
                
                paintColorBox.dataset.colorName = assignedPaint.name || '';
                paintColorBox.dataset.colorType = Array.isArray(assignedPaint.type) ? assignedPaint.type.join(', ') : (assignedPaint.type || '');
                paintColorBox.dataset.colorProducer = assignedPaint.producer || '';
                addHoverTooltipToColorBox(paintColorBox);
                
                // Status icons
                const inMyCollection = isInMyCollection(assignedPaint);
                const inShoppingList = isInShoppingList(assignedPaint);
                
                if (!inMyCollection) {
                    if (inShoppingList) {
                        const shoppingIcon = document.createElement('div');
                        shoppingIcon.className = 'planning-paint-status-icon planning-shopping-icon';
                        shoppingIcon.innerHTML = '🛒';
                        shoppingIcon.style.position = 'absolute';
                        shoppingIcon.style.bottom = '2px';
                        shoppingIcon.style.left = '2px';
                        paintColorBox.appendChild(shoppingIcon);
                    } else {
                        const questionIcon = document.createElement('div');
                        questionIcon.className = 'planning-paint-status-icon planning-question-icon';
                        questionIcon.innerHTML = '❓';
                        questionIcon.style.position = 'absolute';
                        questionIcon.style.bottom = '2px';
                        questionIcon.style.left = '2px';
                        questionIcon.style.backgroundColor = 'red';
                        questionIcon.style.borderRadius = '50%';
                        questionIcon.style.width = '18px';
                        questionIcon.style.height = '18px';
                        questionIcon.style.display = 'flex';
                        questionIcon.style.alignItems = 'center';
                        questionIcon.style.justifyContent = 'center';
                        questionIcon.style.fontSize = '12px';
                        paintColorBox.appendChild(questionIcon);
                    }
                }
                
                const nameWrapper = document.createElement('div');
                nameWrapper.className = 'candidate-name-wrapper';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'candidate-name';
                nameSpan.textContent = assignedPaint.name || '';
                nameWrapper.appendChild(nameSpan);
                
                if (assignedPaint.type && Array.isArray(assignedPaint.type) && assignedPaint.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = assignedPaint.type.join(', ');
                    nameWrapper.appendChild(typeSpan);
                }
                
                container.appendChild(paintColorBox);
                container.appendChild(nameWrapper);
            } else if (mixingScheme && mixingScheme.resultHex) {
                // Show mixing scheme
                if (mixingScheme.colors && mixingScheme.colors.length === 1) {
                    // Single paint - show as regular paint
                    const singlePaint = mixingScheme.colors[0];
                    const paintColorBox = document.createElement('div');
                    paintColorBox.className = 'color-box';
                    paintColorBox.style.backgroundColor = singlePaint.hex;
                    paintColorBox.style.position = 'relative';
                    addGradientClickToColorBox(paintColorBox, singlePaint.hex);
                    paintColorBox.dataset.colorName = singlePaint.name || '';
                    paintColorBox.dataset.colorType = Array.isArray(singlePaint.type) ? singlePaint.type.join(', ') : (singlePaint.type || '');
                    paintColorBox.dataset.colorProducer = singlePaint.producer || '';
                    addHoverTooltipToColorBox(paintColorBox);
                    
                    const inMyCollection = isInMyCollection(singlePaint);
                    const inShoppingList = isInShoppingList(singlePaint);
                    if (!inMyCollection) {
                        if (inShoppingList) {
                            const shoppingIcon = document.createElement('div');
                            shoppingIcon.className = 'planning-paint-status-icon planning-shopping-icon';
                            shoppingIcon.innerHTML = '🛒';
                            shoppingIcon.style.position = 'absolute';
                            shoppingIcon.style.bottom = '2px';
                            shoppingIcon.style.left = '2px';
                            paintColorBox.appendChild(shoppingIcon);
                        } else {
                            const questionIcon = document.createElement('div');
                            questionIcon.className = 'planning-paint-status-icon planning-question-icon';
                            questionIcon.innerHTML = '❓';
                            questionIcon.style.position = 'absolute';
                            questionIcon.style.bottom = '2px';
                            questionIcon.style.left = '2px';
                            questionIcon.style.backgroundColor = 'red';
                            questionIcon.style.borderRadius = '50%';
                            questionIcon.style.width = '18px';
                            questionIcon.style.height = '18px';
                            questionIcon.style.display = 'flex';
                            questionIcon.style.alignItems = 'center';
                            questionIcon.style.justifyContent = 'center';
                            questionIcon.style.fontSize = '12px';
                            paintColorBox.appendChild(questionIcon);
                        }
                    }
                    
                    const nameWrapper = document.createElement('div');
                    nameWrapper.className = 'candidate-name-wrapper';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'candidate-name';
                    nameSpan.textContent = singlePaint.name || '';
                    nameWrapper.appendChild(nameSpan);
                    if (singlePaint.type && Array.isArray(singlePaint.type) && singlePaint.type.length > 0) {
                        const typeSpan = document.createElement('span');
                        typeSpan.className = 'paint-type';
                        typeSpan.textContent = singlePaint.type.join(', ');
                        nameWrapper.appendChild(typeSpan);
                    }
                    container.appendChild(paintColorBox);
                    container.appendChild(nameWrapper);
                } else {
                    // Multiple paints - show formula
                    const resultColorBox = document.createElement('div');
                    resultColorBox.className = 'color-box';
                    resultColorBox.style.backgroundColor = mixingScheme.resultHex;
                    resultColorBox.style.position = 'relative';
                    addGradientClickToColorBox(resultColorBox, mixingScheme.resultHex);
                    addHoverTooltipToColorBox(resultColorBox);
                    
                    const nameWrapper = document.createElement('div');
                    nameWrapper.className = 'candidate-name-wrapper';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'candidate-name';
                    nameSpan.textContent = 'Mixed Color';
                    nameWrapper.appendChild(nameSpan);
                    
                    container.appendChild(resultColorBox);
                    container.appendChild(nameWrapper);
                    
                    // Formula
                    if (mixingScheme.colors && mixingScheme.colors.length > 0 && mixingScheme.coefficients) {
                        const formulaContainer = document.createElement('div');
                        formulaContainer.className = 'planning-mixing-formula-container';
                        formulaContainer.style.marginLeft = '15px';
                        formulaContainer.style.backgroundColor = '#fffacd';
                        formulaContainer.style.borderRadius = '6px';
                        formulaContainer.style.display = 'flex';
                        formulaContainer.style.flexWrap = 'wrap';
                        formulaContainer.style.alignItems = 'center';
                        formulaContainer.style.gap = '5px';
                        
                        for (let i = 0; i < mixingScheme.colors.length; i++) {
                            const mixColor = mixingScheme.colors[i];
                            const coefficient = mixingScheme.coefficients[i];
                            
                            if (i > 0) {
                                const plusSpan = document.createElement('span');
                                plusSpan.textContent = '+';
                                plusSpan.style.margin = '0 5px';
                                plusSpan.style.fontWeight = '500';
                                formulaContainer.appendChild(plusSpan);
                            }
                            
                            const coeffSpan = document.createElement('span');
                            coeffSpan.textContent = `${coefficient} ×`;
                            coeffSpan.style.marginRight = '5px';
                            coeffSpan.style.fontWeight = '500';
                            formulaContainer.appendChild(coeffSpan);
                            
                            const colorBox = document.createElement('div');
                            colorBox.className = 'color-box';
                            colorBox.style.display = 'inline-block';
                            colorBox.style.backgroundColor = mixColor.hex;
                            colorBox.style.verticalAlign = 'middle';
                            colorBox.style.position = 'relative';
                            addGradientClickToColorBox(colorBox, mixColor.hex);
                            colorBox.dataset.colorName = mixColor.name || '';
                            colorBox.dataset.colorType = Array.isArray(mixColor.type) ? mixColor.type.join(', ') : (mixColor.type || '');
                            colorBox.dataset.colorProducer = mixColor.producer || '';
                            addHoverTooltipToColorBox(colorBox);
                            
                            const inMyCollection = isInMyCollection(mixColor);
                            const inShoppingList = isInShoppingList(mixColor);
                            if (!inMyCollection) {
                                if (inShoppingList) {
                                    const shoppingIcon = document.createElement('div');
                                    shoppingIcon.className = 'planning-paint-status-icon planning-shopping-icon';
                                    shoppingIcon.style.width = '16px';
                                    shoppingIcon.style.height = '16px';
                                    shoppingIcon.style.fontSize = '10px';
                                    shoppingIcon.innerHTML = '🛒';
                                    shoppingIcon.style.position = 'absolute';
                                    shoppingIcon.style.bottom = '2px';
                                    shoppingIcon.style.left = '2px';
                                    colorBox.appendChild(shoppingIcon);
                                } else {
                                    const questionIcon = document.createElement('div');
                                    questionIcon.className = 'planning-paint-status-icon planning-question-icon';
                                    questionIcon.style.width = '16px';
                                    questionIcon.style.height = '16px';
                                    questionIcon.style.fontSize = '10px';
                                    questionIcon.innerHTML = '❓';
                                    questionIcon.style.position = 'absolute';
                                    questionIcon.style.bottom = '2px';
                                    questionIcon.style.left = '2px';
                                    questionIcon.style.backgroundColor = 'red';
                                    questionIcon.style.borderRadius = '50%';
                                    questionIcon.style.display = 'flex';
                                    questionIcon.style.alignItems = 'center';
                                    questionIcon.style.justifyContent = 'center';
                                    colorBox.appendChild(questionIcon);
                                }
                            }
                            formulaContainer.appendChild(colorBox);
                        }
                        container.appendChild(formulaContainer);
                    }
                }
            }
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'planning-delete-btn';
            deleteBtn.type = 'button';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.style.display = 'none';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '50%';
            deleteBtn.style.right = '10px';
            deleteBtn.style.transform = 'translateY(-50%)';
            deleteBtn.style.background = 'rgba(244, 67, 54, 0.9)';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '4px';
            deleteBtn.style.padding = '4px 8px';
            deleteBtn.style.cursor = 'pointer';
            
            container.addEventListener('mouseenter', () => {
                deleteBtn.style.display = 'block';
            });
            container.addEventListener('mouseleave', () => {
                deleteBtn.style.display = 'none';
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeMapping(paletteColorHex);
                updateCallback();
            });
            
            container.appendChild(deleteBtn);
            cell.appendChild(container);
        } else {
            // Empty mapping - show empty icon
            const emptyIcon = document.createElement('div');
            emptyIcon.innerHTML = '∅';
            emptyIcon.style.fontSize = '24px';
            emptyIcon.style.opacity = '0.3';
            emptyIcon.style.textAlign = 'center';
            cell.appendChild(emptyIcon);
        }
        
        return cell;
    }
    
    // Helper function to create edit mode candidate cell
    function createEditModeCandidateCell(candidateMatch, onClickCallback, highlightType, mapping) {
        const cell = document.createElement('td');
        cell.style.position = 'relative';
        
        // Highlight if mapping exists for this candidate
        if (highlightType && mapping && mapping[highlightType]) {
            cell.classList.add('planning-cell-highlight');
        }
        
        if (candidateMatch) {
            const container = document.createElement('div');
            container.className = 'candidate-container';
            container.style.position = 'relative';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = candidateMatch.hex;
            addGradientClickToColorBox(colorBox, candidateMatch.hex);
            colorBox.dataset.colorName = candidateMatch.name || '';
            colorBox.dataset.colorType = Array.isArray(candidateMatch.type) ? candidateMatch.type.join(', ') : (candidateMatch.type || '');
            colorBox.dataset.colorProducer = candidateMatch.producer || '';
            addHoverTooltipToColorBox(colorBox);
            
            const nameWrapper = document.createElement('div');
            nameWrapper.className = 'candidate-name-wrapper';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'candidate-name';
            nameSpan.textContent = candidateMatch.name || '';
            nameWrapper.appendChild(nameSpan);
            
            if (candidateMatch.type && Array.isArray(candidateMatch.type) && candidateMatch.type.length > 0) {
                const typeSpan = document.createElement('span');
                typeSpan.className = 'paint-type';
                typeSpan.textContent = candidateMatch.type.join(', ');
                nameWrapper.appendChild(typeSpan);
            }
            
            container.appendChild(colorBox);
            container.appendChild(nameWrapper);
            
            // Assign button (checkmark)
            const assignBtn = document.createElement('button');
            assignBtn.className = 'planning-assign-btn';
            assignBtn.type = 'button';
            assignBtn.innerHTML = '✓';
            assignBtn.style.display = 'none';
            assignBtn.style.position = 'absolute';
            assignBtn.style.top = '50%';
            assignBtn.style.right = '10px';
            assignBtn.style.transform = 'translateY(-50%)';
            assignBtn.style.background = 'rgba(76, 175, 80, 0.9)';
            assignBtn.style.color = 'white';
            assignBtn.style.border = 'none';
            assignBtn.style.borderRadius = '4px';
            assignBtn.style.padding = '4px 8px';
            assignBtn.style.cursor = 'pointer';
            
            container.addEventListener('mouseenter', () => {
                if (!mapping || !mapping[highlightType]) {
                    assignBtn.style.display = 'block';
                }
            });
            container.addEventListener('mouseleave', () => {
                assignBtn.style.display = 'none';
            });
            
            assignBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onClickCallback();
            });
            
            container.appendChild(assignBtn);
            cell.appendChild(container);
        } else {
            cell.textContent = 'No match found';
        }
        
        return cell;
    }
    
    // Helper function to create edit mode From All cell
    function createEditModeFromAllCell(fromAllMatch, color, mapping) {
        const cell = document.createElement('td');
        cell.style.position = 'relative';
        
        // Highlight if mapping exists
        if (mapping && mapping.fromAll) {
            cell.classList.add('planning-cell-highlight');
        }
        
        if (fromAllMatch) {
            const container = document.createElement('div');
            container.className = 'candidate-container';
            container.style.position = 'relative';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = fromAllMatch.hex;
            addGradientClickToColorBox(colorBox, fromAllMatch.hex);
            colorBox.dataset.colorName = fromAllMatch.name || '';
            colorBox.dataset.colorType = Array.isArray(fromAllMatch.type) ? fromAllMatch.type.join(', ') : (fromAllMatch.type || '');
            colorBox.dataset.colorProducer = fromAllMatch.producer || '';
            addHoverTooltipToColorBox(colorBox);
            
            const nameWrapper = document.createElement('div');
            nameWrapper.className = 'candidate-name-wrapper';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'candidate-name';
            nameSpan.textContent = fromAllMatch.name || '';
            nameWrapper.appendChild(nameSpan);
            
            if (fromAllMatch.type && Array.isArray(fromAllMatch.type) && fromAllMatch.type.length > 0) {
                const typeSpan = document.createElement('span');
                typeSpan.className = 'paint-type';
                typeSpan.textContent = fromAllMatch.type.join(', ');
                nameWrapper.appendChild(typeSpan);
            }
            
            container.appendChild(colorBox);
            container.appendChild(nameWrapper);
            
            // Buy button (shopping cart)
            const buyBtn = document.createElement('button');
            buyBtn.className = 'planning-buy-btn';
            buyBtn.type = 'button';
            buyBtn.innerHTML = '🛒';
            buyBtn.style.display = 'none';
            buyBtn.style.position = 'absolute';
            buyBtn.style.top = '50%';
            buyBtn.style.right = '10px';
            buyBtn.style.transform = 'translateY(-50%)';
            buyBtn.style.background = 'rgba(245, 158, 11, 0.9)';
            buyBtn.style.color = 'white';
            buyBtn.style.border = 'none';
            buyBtn.style.borderRadius = '4px';
            buyBtn.style.padding = '4px 8px';
            buyBtn.style.cursor = 'pointer';
            
            container.addEventListener('mouseenter', () => {
                if (!mapping || !mapping.fromAll) {
                    buyBtn.style.display = 'block';
                }
            });
            container.addEventListener('mouseleave', () => {
                buyBtn.style.display = 'none';
            });
            
            buyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (fromAllMatch && addToShoppingCart) {
                    addToShoppingCart(fromAllMatch);
                }
                saveMapping(color.hex, 'fromAll', fromAllMatch);
                updatePlanningTable();
            });
            
            container.appendChild(buyBtn);
            cell.appendChild(container);
        } else {
            cell.textContent = 'No match found';
        }
        
        return cell;
    }
    
    // Helper function to create edit mode mixing cell
    function createEditModeMixingCell(color, candidate1Match, candidate2Match, fromAllMatch, mapping) {
        const cell = document.createElement('td');
        cell.className = 'planning-mixing-cell';
        cell.style.position = 'relative';
        
        const mixingScheme = mapping?.mixingScheme;
        
        // Highlight if mixing scheme exists
        if (mixingScheme) {
            cell.classList.add('planning-cell-highlight');
        }
        
        if (mixingScheme && mixingScheme.resultHex) {
            // Show result color with edit button
            const container = document.createElement('div');
            container.className = 'planning-mixing-container';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.gap = '10px';
            
            const resultColorBox = document.createElement('div');
            resultColorBox.className = 'color-box planning-mixing-result-box';
            resultColorBox.style.width = '40px';
            resultColorBox.style.height = '40px';
            resultColorBox.style.backgroundColor = mixingScheme.resultHex;
            resultColorBox.style.position = 'relative';
            resultColorBox.style.cursor = 'pointer';
            addGradientClickToColorBox(resultColorBox, mixingScheme.resultHex);
            addHoverTooltipToColorBox(resultColorBox);
            
            // Edit button on hover
            const editBtn = document.createElement('button');
            editBtn.className = 'planning-mixing-edit-btn';
            editBtn.type = 'button';
            editBtn.innerHTML = '✎';
            editBtn.style.display = 'none';
            editBtn.style.position = 'absolute';
            editBtn.style.top = '50%';
            editBtn.style.left = '50%';
            editBtn.style.transform = 'translate(-50%, -50%)';
            editBtn.style.background = 'rgba(102, 126, 234, 0.9)';
            editBtn.style.color = 'white';
            editBtn.style.border = 'none';
            editBtn.style.borderRadius = '4px';
            editBtn.style.padding = '4px 8px';
            editBtn.style.cursor = 'pointer';
            editBtn.style.zIndex = '10';
            
            resultColorBox.addEventListener('mouseenter', () => {
                editBtn.style.display = 'block';
            });
            resultColorBox.addEventListener('mouseleave', () => {
                editBtn.style.display = 'none';
            });
            
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                import('./mixing.js').then(({ openCustomMixModalWithScheme }) => {
                    openCustomMixModalWithScheme(color, mixingScheme);
                }).catch(err => {
                    console.error('Error importing openCustomMixModalWithScheme:', err);
                });
            });
            
            resultColorBox.appendChild(editBtn);
            container.appendChild(resultColorBox);
            cell.appendChild(container);
        } else {
            // Show Mix button
            const mixBtn = document.createElement('button');
            mixBtn.className = 'planning-mix-btn';
            mixBtn.type = 'button';
            mixBtn.textContent = 'Mix';
            mixBtn.style.display = 'block';
            mixBtn.style.padding = '8px 16px';
            mixBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            mixBtn.style.color = 'white';
            mixBtn.style.border = 'none';
            mixBtn.style.borderRadius = '4px';
            mixBtn.style.cursor = 'pointer';
            mixBtn.addEventListener('click', () => {
                import('./mixing.js').then(({ openCustomMixModalWithColors }) => {
                    openCustomMixModalWithColors(color, candidate1Match, candidate2Match, fromAllMatch);
                }).catch(err => {
                    console.error('Error importing openCustomMixModalWithColors:', err);
                });
            });
            cell.appendChild(mixBtn);
        }
        
        return cell;
    }

    // Store globally for other modules to call BEFORE initial load
    window.updatePlanningTable = updatePlanningTable;
    
    // Initial load - this will use the current mode
    updatePlanningTable();
    
    // Update mode toggle button
    if (window.updatePlanningModeToggle) {
        window.updatePlanningModeToggle();
    }
    
    return updatePlanningTable;
}

// Initialize sort order dropdown
export function initSortOrder(dependencies = {}) {
    if (dependencies.saveSortOrder) {
        saveSortOrder = dependencies.saveSortOrder;
    }
    if (dependencies.setSortOrder) {
        setSortOrder = dependencies.setSortOrder;
    }
    if (dependencies.sortPaletteByHSV) {
        sortPaletteByHSV = dependencies.sortPaletteByHSV;
    }
    if (dependencies.savePalette) {
        savePalette = dependencies.savePalette;
    }
    if (dependencies.loadPalette) {
        loadPalette = dependencies.loadPalette;
    }
    
    const sortOrderSelect = document.getElementById('sortOrderSelect');
    const sortOrderSelectPlanning = document.getElementById('sortOrderSelectPlanning');
    
    const handleSortOrderChange = (newSortOrder) => {
        if (setSortOrder) {
            setSortOrder(newSortOrder);
        }
        if (saveSortOrder) {
            saveSortOrder(newSortOrder);
        }
        
        if (sortOrderSelect) {
            sortOrderSelect.value = newSortOrder;
        }
        if (sortOrderSelectPlanning) {
            sortOrderSelectPlanning.value = newSortOrder;
        }
        
        // Re-sort and reload palette
        const palette = getPalette();
        if (sortPaletteByHSV) {
            const sortedPalette = sortPaletteByHSV(palette, newSortOrder);
            // Update state and save
            if (savePalette && loadPalette) {
                // This will be handled by palette module
                loadPalette();
            }
        }
    };
    
    if (sortOrderSelect) {
        sortOrderSelect.value = state.sortOrder;
        sortOrderSelect.addEventListener('change', (e) => {
            handleSortOrderChange(e.target.value);
        });
    }
    
    if (sortOrderSelectPlanning) {
        sortOrderSelectPlanning.value = state.sortOrder;
        sortOrderSelectPlanning.addEventListener('change', (e) => {
            handleSortOrderChange(e.target.value);
        });
    }
}

// Initialize saturation threshold
export function initSaturationThreshold() {
    const saturationThresholdInput = document.getElementById('saturationThreshold');
    if (saturationThresholdInput) {
        saturationThresholdInput.value = state.saturationThreshold;
        saturationThresholdInput.addEventListener('input', (e) => {
            const threshold = parseFloat(e.target.value);
            state.saturationThreshold = threshold;
            // Save to localStorage would be handled by storage module
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        });
    }
}

// Check and set planning mode based on mappings
export function checkAndSetPlanningMode() {
    const paletteId = getCurrentPaletteId();
    const mappings = getPlanningMappings();
    
    let newMode = 'edit'; // Default to edit
    
    if (paletteId && mappings && mappings[paletteId]) {
        const paletteMappings = mappings[paletteId];
        
        // Check if there's at least one mapping
        const hasMapping = Object.keys(paletteMappings).some(colorHex => {
            const mapping = paletteMappings[colorHex];
            return mapping && (mapping.candidate1 || mapping.candidate2 || mapping.fromAll || mapping.mixingScheme);
        });
        
        if (hasMapping) {
            newMode = 'view';
        }
    }
    
    // Set the mode - this will automatically trigger:
    // 1. loadPlanningTable() via subscription
    // 2. Button update via subscription
    setPlanningMode(newMode);
}

// Initialize planning add color modal
function initPlanningAddColorModal() {
    const modal = document.getElementById('planningAddColorModal');
    const addBtn = document.getElementById('planningAddBtn');
    const closeBtn = document.getElementById('closePlanningAddColorModal');
    const canvas = document.getElementById('planningAddColorWheelCanvas');
    const valueSlider = document.getElementById('planningValueSlider');
    const valueDisplay = document.getElementById('planningValueDisplay');
    const colorPreview = document.getElementById('planningColorPreview');
    const useBtn = document.getElementById('planningUseColorBtn');
    
    if (!modal || !addBtn || !closeBtn || !canvas || !valueSlider || !valueDisplay || !colorPreview || !useBtn) {
        return;
    }
    
    let ctx = canvas.getContext('2d');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    
    // Current selected color (HSV)
    let selectedH = 0; // Hue: 0-360
    let selectedS = 0; // Saturation: 0-1
    let selectedV = 0.5; // Value: 0-1 (from slider)
    
    // Draw color wheel with current value
    function drawColorWheel() {
        ctx.clearRect(0, 0, size, size);
        
        // Use ImageData for better performance
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        // Draw color wheel
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= radius) {
                    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                    const saturation = Math.min(distance / radius, 1);
                    const value = selectedV; // Use slider value
                    
                    const rgb = hsvToRGB(angle, saturation, value);
                    
                    const index = (y * size + x) * 4;
                    data[index] = rgb.r;
                    data[index + 1] = rgb.g;
                    data[index + 2] = rgb.b;
                    data[index + 3] = 255;
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Add white center gradient for saturation
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        
        // Add black outer ring
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
    
    // Update color preview
    function updateColorPreview() {
        const rgb = hsvToRGB(selectedH, selectedS, selectedV);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        colorPreview.style.backgroundColor = hex;
    }
    
    // Handle color wheel click
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= radius) {
            const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            const saturation = Math.min(distance / radius, 1);
            
            selectedH = angle;
            selectedS = saturation;
            
            updateColorPreview();
        }
    });
    
    // Handle value slider change
    valueSlider.addEventListener('input', (e) => {
        const valuePercent = parseFloat(e.target.value);
        valueDisplay.textContent = Math.round(valuePercent);
        selectedV = valuePercent / 100; // Convert 0-100 to 0-1
        drawColorWheel();
        updateColorPreview();
    });
    
    // Open modal
    addBtn.addEventListener('click', () => {
        // Grey out other wheels
        if (window.greyOutOtherWheels) {
            window.greyOutOtherWheels();
        }
        
        // Reset to default values
        selectedH = 0;
        selectedS = 0;
        selectedV = 0.5;
        valueSlider.value = 50;
        valueDisplay.textContent = '50';
        
        // Draw initial wheel
        drawColorWheel();
        updateColorPreview();
        
        modal.classList.add('active');
    });
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        if (window.ungreyOtherWheels) {
            window.ungreyOtherWheels();
        }
    });
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            if (window.ungreyOtherWheels) {
                window.ungreyOtherWheels();
            }
        }
    });
    
    // Close modal on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
            if (window.ungreyOtherWheels) {
                window.ungreyOtherWheels();
            }
        }
    });
    
    // Use button - add color to palette
    useBtn.addEventListener('click', () => {
        const rgb = hsvToRGB(selectedH, selectedS, selectedV);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Ungrey other wheels
        if (window.ungreyOtherWheels) {
            window.ungreyOtherWheels();
        }
        
        const color = {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            hex: hex,
            name: `Custom Color (H: ${Math.round(selectedH)}°, S: ${Math.round(selectedS * 100)}%, V: ${Math.round(selectedV * 100)}%)`,
            type: [],
            producer: 'Custom'
        };
        
        if (addColorToPalette) {
            if (addColorToPalette(color)) {
                // Color added successfully
                modal.classList.remove('active');
                // Reload planning table to show the new color
                if (window.loadPlanningTable) {
                    window.loadPlanningTable();
                }
            } else {
                alert('This color is already in your palette!');
            }
        }
    });
    
    // Initial draw
    drawColorWheel();
    updateColorPreview();
}

// Initialize planning mode toggle button
function initPlanningModeToggle() {
    const modeToggleBtn = document.getElementById('planningModeToggleBtn');
    if (!modeToggleBtn) return;
    
    function updateModeToggleButton() {
        const mode = getPlanningMode();
        if (mode === 'view') {
            modeToggleBtn.textContent = 'Edit';
        } else {
            modeToggleBtn.textContent = 'Save';
        }
        
        // Show button only if there are colors in palette
        const palette = getPalette();
        if (palette.length > 0) {
            modeToggleBtn.style.display = 'block';
        } else {
            modeToggleBtn.style.display = 'none';
        }
    }
    
    // Subscribe to mode changes - button will update automatically
    onPlanningModeChange(() => {
        updateModeToggleButton();
    });
    
    modeToggleBtn.addEventListener('click', () => {
        const currentMode = getPlanningMode();
        // Toggle between view and edit modes
        const newMode = currentMode === 'view' ? 'edit' : 'view';
        setPlanningMode(newMode);
        // loadPlanningTable() and button update will be called automatically via mode change subscription
    });
    
    // Initial update
    updateModeToggleButton();
    
    // Update when table changes
    window.updatePlanningModeToggle = updateModeToggleButton;
}

// Initialize planning module
export function initPlanning(dependencies = {}) {
    initSortOrder(dependencies);
    
    if (dependencies.addToShoppingCart) {
        addToShoppingCart = dependencies.addToShoppingCart;
    }
    
    if (dependencies.addColorToPalette) {
        addColorToPalette = dependencies.addColorToPalette;
    }
    
    initPlanningAddColorModal();
    initPlanningModeToggle();
    
    initSaturationThreshold();
    
    // Subscribe to mode changes - table will reload automatically when mode changes
    onPlanningModeChange(() => {
        loadPlanningTable();
    });
    
    // Check if Planning tab is already active on page load
    const planningTab = document.getElementById('planningTab');
    if (planningTab && planningTab.classList.contains('active')) {
        // Planning tab is active, check and set mode (which will trigger loadPlanningTable via subscription)
        checkAndSetPlanningMode();
    }
    // If Planning tab is not active, don't load the table yet - it will be loaded
    // when the tab is activated via checkAndSetPlanningMode()
}

