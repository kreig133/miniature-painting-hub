/**
 * Planning feature - color matching and planning table
 */

import { rgbToHSV, hsvDistance, addGradientClickToColorBox, hexToRgb, hsvToRGB, rgbToHex, ciede2000Distance } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import { state, getPalette, getMyCollection, getMergedPaintColors, getCurrentModelId, getColorMapping, setColorMapping, removeColorMapping, getPlanningMode, setPlanningMode, getShoppingCart, onPlanningModeChange, getPalleteWithMappings } from '../core/state.js';
import { updateHeaderCount, getEffectiveMyCollection } from './myCollection.js';
import { filterData, createFilterCheckboxes } from './filters.js';

// Dependencies
let saveSortOrder = null;
let setSortOrder = null;
let sortPaletteByHSV = null;
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
    return getColorMapping(colorHex);
}

// Check if mapping is a MixingSchemeObject (has colors and coefficients)
function isMixingScheme(mapping) {
    return mapping && typeof mapping === 'object' && Array.isArray(mapping.colors) && Array.isArray(mapping.coefficients);
}

// Check if mapping is a PaintObject (has hex, name, producer, type but not colors/coefficients)
function isPaintObject(mapping) {
    return mapping && typeof mapping === 'object' && mapping.hex && !Array.isArray(mapping.colors);
}

function getAssignedPaint(mapping) {
    if (!mapping) return null;
    // If it's a mixing scheme, return null (handled separately)
    if (isMixingScheme(mapping)) return null;
    // Otherwise it's a paint object
    return mapping;
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
    setColorMapping(colorHex, mixingScheme);
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
                <th>Color</th>
                <th>Mapping</th>
            `;
        } else {
            thead.innerHTML = `
                <th>Color</th>
                <th>Candidate 1</th>
                <th>Candidate 2</th>
                <th>From All</th>
                <th>Manual</th>
                <th>Mixing</th>
            `;
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
            cell.colSpan = currentMode === 'view' ? 2 : 6;
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
                        setColorMapping(color.hex, candidate1Match);
                        updatePlanningTable();
                    }
                }, mapping, candidate1Match);
                row.appendChild(candidate1Cell);
                
                // Candidate 2
                const candidate2Match = findNthClosestFromMyCollection(color, 2, 'planningFilters');
                const candidate2Cell = createEditModeCandidateCell(candidate2Match, () => {
                    if (candidate2Match) {
                        setColorMapping(color.hex, candidate2Match);
                        updatePlanningTable();
                    }
                }, mapping, candidate2Match);
                row.appendChild(candidate2Cell);
                
                // From All
                const fromAllMatch = findClosestFromPaintColors(color, 'planningFilters');
                const fromAllCell = createEditModeFromAllCell(fromAllMatch, color, mapping);
                row.appendChild(fromAllCell);
                
                // Manual - only show paint if it's not in any other column
                const manualCell = createEditModeManualCell(color, mapping, candidate1Match, candidate2Match, fromAllMatch);
                row.appendChild(manualCell);
                
                // Mixing
                const mixingCell = createEditModeMixingCell(color, candidate1Match, candidate2Match, fromAllMatch, mapping);
                row.appendChild(mixingCell);
                
                tbody.appendChild(row);
            });
        }
        
        // Add footer with icon legend (shown in both modes)
        const tfoot = planningTable.querySelector('tfoot');
        if (tfoot) {
            tfoot.remove();
        }
        const newTfoot = document.createElement('tfoot');
        const footerRow = document.createElement('tr');
        const footerCell = document.createElement('td');
        footerCell.colSpan = currentMode === 'view' ? 2 : 6;
        footerCell.style.textAlign = 'left';
        footerCell.style.padding = '15px';
        footerCell.style.background = '#f8f9fa';
        footerCell.style.borderTop = '2px solid #e0e0e0';
        footerCell.style.fontSize = '0.9rem';
        footerCell.style.color = '#666';
        
        const legendContainer = document.createElement('div');
        legendContainer.style.display = 'flex';
        legendContainer.style.alignItems = 'center';
        legendContainer.style.gap = '20px';
        
        if (currentMode === 'view') {
            // View mode: show shopping cart and question mark icons
            // Shopping cart icon legend
            const shoppingLegend = document.createElement('div');
            shoppingLegend.style.display = 'flex';
            shoppingLegend.style.alignItems = 'center';
            shoppingLegend.style.gap = '8px';
            const shoppingIconLegend = document.createElement('div');
            shoppingIconLegend.className = 'planning-paint-status-icon planning-shopping-icon';
            shoppingIconLegend.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
            shoppingIconLegend.style.position = 'static';
            shoppingLegend.appendChild(shoppingIconLegend);
            const shoppingText = document.createElement('span');
            shoppingText.textContent = 'Paint in shopping cart';
            shoppingLegend.appendChild(shoppingText);
            legendContainer.appendChild(shoppingLegend);
            
            // Question mark icon legend
            const questionLegend = document.createElement('div');
            questionLegend.style.display = 'flex';
            questionLegend.style.alignItems = 'center';
            questionLegend.style.gap = '8px';
            const questionIconLegend = document.createElement('div');
            questionIconLegend.className = 'planning-paint-status-icon planning-question-icon';
            questionIconLegend.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            questionIconLegend.style.position = 'static';
            questionLegend.appendChild(questionIconLegend);
            const questionText = document.createElement('span');
            questionText.textContent = 'Paint is not in any collection';
            questionLegend.appendChild(questionText);
            legendContainer.appendChild(questionLegend);
        } else {
            // Edit mode: show "Mixing" text and shopping cart icon
            // Mixing text
            const mixingLegend = document.createElement('div');
            mixingLegend.style.display = 'flex';
            mixingLegend.style.alignItems = 'center';
            mixingLegend.style.gap = '8px';
            const mixingText = document.createElement('span');
            mixingText.textContent = 'Mixing - mix several paints';
            mixingLegend.appendChild(mixingText);
            legendContainer.appendChild(mixingLegend);
            
            // Shopping cart icon legend
            const shoppingLegend = document.createElement('div');
            shoppingLegend.style.display = 'flex';
            shoppingLegend.style.alignItems = 'center';
            shoppingLegend.style.gap = '8px';
            const shoppingIconLegend = document.createElement('div');
            shoppingIconLegend.className = 'planning-paint-status-icon planning-shopping-icon';
            shoppingIconLegend.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
            shoppingIconLegend.style.position = 'static';
            shoppingLegend.appendChild(shoppingIconLegend);
            const shoppingText = document.createElement('span');
            shoppingText.textContent = 'Add paint to shopping list';
            shoppingLegend.appendChild(shoppingText);
            legendContainer.appendChild(shoppingLegend);
        }
        
        footerCell.appendChild(legendContainer);
        footerRow.appendChild(footerCell);
        newTfoot.appendChild(footerRow);
        planningTable.appendChild(newTfoot);
    }
    
    // Helper function to create view mode mapping cell
    function createViewModeMappingCell(mapping, paletteColorHex, updateCallback) {
        const cell = document.createElement('td');
        
        const assignedPaint = getAssignedPaint(mapping);
        const mixingScheme = isMixingScheme(mapping) ? mapping : null;
        
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
                        shoppingIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
                        shoppingIcon.style.position = 'absolute';
                        shoppingIcon.style.bottom = '2px';
                        shoppingIcon.style.left = '2px';
                        paintColorBox.appendChild(shoppingIcon);
                    } else {
                        const questionIcon = document.createElement('div');
                        questionIcon.className = 'planning-paint-status-icon planning-question-icon';
                        questionIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
                        questionIcon.style.position = 'absolute';
                        questionIcon.style.bottom = '2px';
                        questionIcon.style.left = '2px';
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
                            shoppingIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
                            shoppingIcon.style.position = 'absolute';
                            shoppingIcon.style.bottom = '2px';
                            shoppingIcon.style.left = '2px';
                            paintColorBox.appendChild(shoppingIcon);
                        } else {
                            const questionIcon = document.createElement('div');
                            questionIcon.className = 'planning-paint-status-icon planning-question-icon';
                            questionIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
                            questionIcon.style.position = 'absolute';
                            questionIcon.style.bottom = '2px';
                            questionIcon.style.left = '2px';
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
                                    shoppingIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
                                    shoppingIcon.style.position = 'absolute';
                                    shoppingIcon.style.bottom = '2px';
                                    shoppingIcon.style.left = '2px';
                                    colorBox.appendChild(shoppingIcon);
                                } else {
                                    const questionIcon = document.createElement('div');
                                    questionIcon.className = 'planning-paint-status-icon planning-question-icon';
                                    questionIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
                                    questionIcon.style.position = 'absolute';
                                    questionIcon.style.bottom = '2px';
                                    questionIcon.style.left = '2px';
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
            deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            deleteBtn.style.display = 'none';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '50%';
            deleteBtn.style.right = '10px';
            deleteBtn.style.transform = 'translateY(-50%)';
            deleteBtn.style.cursor = 'pointer';
            
            container.addEventListener('mouseenter', () => {
                deleteBtn.style.display = 'block';
            });
            container.addEventListener('mouseleave', () => {
                deleteBtn.style.display = 'none';
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeColorMapping(paletteColorHex);
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
    
    function createEditModeCandidateCell(candidateMatch, onClickCallback, mapping, candidateMatchForHighlight) {
        const cell = document.createElement('td');
        cell.style.position = 'relative';
        
        // Highlight if mapping exists and matches this candidate (is a PaintObject and matches)
        if (mapping && isPaintObject(mapping) && candidateMatchForHighlight && 
            mapping.hex === candidateMatchForHighlight.hex && 
            mapping.name === candidateMatchForHighlight.name &&
            mapping.producer === candidateMatchForHighlight.producer) {
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
            
            const isHighlighted = mapping && isPaintObject(mapping) && candidateMatchForHighlight && 
                mapping.hex === candidateMatchForHighlight.hex && 
                mapping.name === candidateMatchForHighlight.name &&
                mapping.producer === candidateMatchForHighlight.producer;
            
            container.addEventListener('mouseenter', () => {
                if (!isHighlighted) {
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
        
        // Highlight if mapping exists and matches fromAllMatch (is a PaintObject and matches)
        if (mapping && isPaintObject(mapping) && fromAllMatch &&
            mapping.hex === fromAllMatch.hex && 
            mapping.name === fromAllMatch.name &&
            mapping.producer === fromAllMatch.producer) {
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
            buyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
            buyBtn.style.display = 'none';
            
            const isHighlighted = mapping && isPaintObject(mapping) && fromAllMatch &&
                mapping.hex === fromAllMatch.hex && 
                mapping.name === fromAllMatch.name &&
                mapping.producer === fromAllMatch.producer;
            
            container.addEventListener('mouseenter', () => {
                if (!isHighlighted) {
                    buyBtn.style.display = 'flex';
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
                setColorMapping(color.hex, fromAllMatch);
                updatePlanningTable();
            });
            
            container.appendChild(buyBtn);
            cell.appendChild(container);
        } else {
            cell.textContent = 'No match found';
        }
        
        return cell;
    }
    
    // Helper function to sort paints by similarity to target color
    function sortPaintsBySimilarity(paints, targetColor) {
        const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
        
        return paints.map(paint => {
            const rgb = hexToRgb(paint.hex);
            if (!rgb) return { paint, distance: Infinity };
            
            const candidateHSV = rgbToHSV(rgb.r, rgb.g, rgb.b);
            const distance = hsvDistance(targetHSV, candidateHSV);
            
            return { paint, distance };
        }).sort((a, b) => a.distance - b.distance).map(item => item.paint);
    }
    
    // Helper function to create edit mode manual cell
    function createEditModeManualCell(color, mapping, candidate1Match, candidate2Match, fromAllMatch) {
        const cell = document.createElement('td');
        cell.style.position = 'relative';
        
        // Only show manual paint if it's NOT a mixing scheme and NOT in any other column
        const isMixing = isMixingScheme(mapping);
        const assignedPaint = isMixing ? null : getAssignedPaint(mapping);
        
        // Check if assigned paint matches any of the other columns
        let isInOtherColumn = false;
        if (assignedPaint) {
            // Check if it matches Candidate 1
            if (candidate1Match && assignedPaint.hex === candidate1Match.hex && 
                assignedPaint.name === candidate1Match.name && 
                assignedPaint.producer === candidate1Match.producer) {
                isInOtherColumn = true;
            }
            // Check if it matches Candidate 2
            if (!isInOtherColumn && candidate2Match && assignedPaint.hex === candidate2Match.hex && 
                assignedPaint.name === candidate2Match.name && 
                assignedPaint.producer === candidate2Match.producer) {
                isInOtherColumn = true;
            }
            // Check if it matches From All
            if (!isInOtherColumn && fromAllMatch && assignedPaint.hex === fromAllMatch.hex && 
                assignedPaint.name === fromAllMatch.name && 
                assignedPaint.producer === fromAllMatch.producer) {
                isInOtherColumn = true;
            }
        }
        
        // Only show paint if it exists and is NOT in any other column
        const showPaint = assignedPaint && !isInOtherColumn;
        
        // Highlight if paint is shown
        if (showPaint) {
            cell.classList.add('planning-cell-highlight');
        }
        
        if (showPaint) {
            // Show color box with edit icon on hover
            const container = document.createElement('div');
            container.className = 'candidate-container';
            container.style.position = 'relative';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = assignedPaint.hex;
            colorBox.style.width = '40px';
            colorBox.style.height = '40px';
            colorBox.style.position = 'relative';
            colorBox.style.cursor = 'pointer';
            addGradientClickToColorBox(colorBox, assignedPaint.hex);
            colorBox.dataset.colorName = assignedPaint.name || '';
            colorBox.dataset.colorType = Array.isArray(assignedPaint.type) ? assignedPaint.type.join(', ') : (assignedPaint.type || '');
            colorBox.dataset.colorProducer = assignedPaint.producer || '';
            addHoverTooltipToColorBox(colorBox);
            
            // Edit icon on hover
            const editIcon = document.createElement('button');
            editIcon.className = 'planning-manual-edit-icon';
            editIcon.type = 'button';
            editIcon.innerHTML = '✎';
            editIcon.style.display = 'none';
            editIcon.style.position = 'absolute';
            editIcon.style.top = '50%';
            editIcon.style.left = '50%';
            editIcon.style.transform = 'translate(-50%, -50%)';
            editIcon.style.background = 'rgba(102, 126, 234, 0.9)';
            editIcon.style.color = 'white';
            editIcon.style.border = 'none';
            editIcon.style.borderRadius = '4px';
            editIcon.style.padding = '4px 8px';
            editIcon.style.cursor = 'pointer';
            editIcon.style.zIndex = '10';
            editIcon.style.fontSize = '14px';
            
            const openManualSelect = () => {
                openManualPaintSelectModal(color, assignedPaint);
            };
            
            colorBox.addEventListener('mouseenter', () => {
                editIcon.style.display = 'block';
            });
            colorBox.addEventListener('mouseleave', () => {
                editIcon.style.display = 'none';
            });
            
            editIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                openManualSelect();
            });
            
            colorBox.addEventListener('click', (e) => {
                if (e.target !== editIcon) {
                    openManualSelect();
                }
            });
            
            colorBox.appendChild(editIcon);
            container.appendChild(colorBox);
            cell.appendChild(container);
        } else {
            // Show Choose button
            const chooseBtn = document.createElement('button');
            chooseBtn.className = 'planning-choose-btn';
            chooseBtn.type = 'button';
            chooseBtn.textContent = 'Choose';
            chooseBtn.style.display = 'block';
            chooseBtn.style.padding = '8px 16px';
            chooseBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            chooseBtn.style.color = 'white';
            chooseBtn.style.border = 'none';
            chooseBtn.style.borderRadius = '4px';
            chooseBtn.style.cursor = 'pointer';
            chooseBtn.addEventListener('click', () => {
                openManualPaintSelectModal(color, null);
            });
            cell.appendChild(chooseBtn);
        }
        
        return cell;
    }
    
    // Function to load manual select table (exported for filter changes)
    function loadManualSelectTable() {
        const modal = document.getElementById('planningManualSelectModal');
        if (!modal) return;
        
        const table = document.getElementById('planningManualSelectTable');
        const tbody = table ? table.querySelector('tbody') : null;
        if (!tbody) return;
        
        // Get the palette color from stored state (we'll need to store it)
        const storedPaletteColor = window.currentManualSelectPaletteColor;
        if (!storedPaletteColor) return;
        
        // Load and sort paints by similarity
        let paints = getMergedPaintColors();
        if (!paints || paints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No colors available</td></tr>';
            return;
        }
        
        // Apply filters
        const filterContainer = document.getElementById('planningManualSelectFilters');
        if (filterContainer) {
            paints = filterData(paints, 'planningManualSelectFilters');
        }
        
        // Sort by similarity to palette color
        paints = sortPaintsBySimilarity(paints, storedPaletteColor);
        
        tbody.innerHTML = '';
        
        if (paints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No colors match the filters</td></tr>';
            return;
        }
        
        paints.forEach(paint => {
            const row = document.createElement('tr');
            row.className = 'color-select-row';
            
            // Color cell
            const colorCell = document.createElement('td');
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = paint.hex;
            colorBox.style.width = '40px';
            colorBox.style.height = '40px';
            colorBox.style.display = 'inline-block';
            addGradientClickToColorBox(colorBox, paint.hex);
            colorCell.appendChild(colorBox);
            row.appendChild(colorCell);
            
            // Name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = paint.name || paint.hex;
            row.appendChild(nameCell);
            
            // Type cell
            const typeCell = document.createElement('td');
            typeCell.textContent = Array.isArray(paint.type) ? paint.type.join(', ') : (paint.type || '');
            row.appendChild(typeCell);
            
            // Producer cell
            const producerCell = document.createElement('td');
            producerCell.textContent = paint.producer || '';
            row.appendChild(producerCell);
            
            // Add check icon (green circle) for pre-selecting paint (shown on hover)
            const selectBtn = document.createElement('button');
            selectBtn.className = 'select-color-btn';
            selectBtn.type = 'button';
            selectBtn.title = 'Select';
            selectBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Pre-select this paint
                currentManualSelectedPaint = paint;
                
                // Show selected paint color box in header
                const selectedColorBox = document.getElementById('planningManualSelectedColorBox');
                if (selectedColorBox) {
                    selectedColorBox.style.display = 'block';
                    selectedColorBox.style.backgroundColor = paint.hex;
                }
                
                // Show Use button
                const useBtn = document.getElementById('planningManualUseBtn');
                if (useBtn) {
                    useBtn.style.display = 'block';
                }
                
                // Update row highlights (remove from all, add to selected)
                const allRows = tbody.querySelectorAll('tr');
                allRows.forEach(r => r.classList.remove('selected-row'));
                row.classList.add('selected-row');
            });
            row.appendChild(selectBtn);
            
            // Add tooltip data
            colorBox.dataset.colorName = paint.name || '';
            colorBox.dataset.colorType = Array.isArray(paint.type) ? paint.type.join(', ') : (paint.type || '');
            colorBox.dataset.colorProducer = paint.producer || '';
            addHoverTooltipToColorBox(colorBox);
            
            tbody.appendChild(row);
        });
    }
    
    // Export for filter changes
    window.loadPlanningManualSelectTable = loadManualSelectTable;
    
    // Store selected paint for manual selection modal
    let currentManualSelectedPaint = null;
    
    // Helper function to open manual paint select modal
    function openManualPaintSelectModal(paletteColor, currentPaint) {
        // Store palette color for filter changes
        window.currentManualSelectPaletteColor = paletteColor;
        // Reset selected paint
        currentManualSelectedPaint = null;
        // Create or get modal (we'll reuse the custom mix color select modal structure)
        let modal = document.getElementById('planningManualSelectModal');
        
        if (!modal) {
            // Create modal structure (similar to customMixColorSelectModal)
            modal = document.createElement('div');
            modal.id = 'planningManualSelectModal';
            modal.className = 'custom-mix-color-select-modal';
            modal.innerHTML = `
                <div class="custom-mix-color-select-content">
                    <div class="custom-mix-color-select-header">
                        <h3>Select Paint</h3>
                        <div class="planning-manual-select-header-buttons">
                            <button class="use-mix-btn" id="planningManualUseBtn" type="button" style="display: none;">Use</button>
                            <button id="closePlanningManualSelectModal" type="button" class="close-color-select-btn">&times;</button>
                        </div>
                    </div>
                    <div class="planning-manual-result-section">
                        <div class="custom-mix-palette-color-box" id="planningManualPaletteColorBox" style="display: none;"></div>
                        <div class="custom-mix-result-box" id="planningManualSelectedColorBox" style="display: none;"></div>
                    </div>
                    <div class="custom-mix-color-select-body">
                        <div class="filter-container" id="planningManualSelectFilters">
                            <!-- Will be populated by JavaScript -->
                        </div>
                        <div class="color-select-table-container">
                            <table id="planningManualSelectTable">
                                <thead>
                                    <tr>
                                        <th>Color</th>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Producer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Will be populated by JavaScript -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Setup close button
            const closeBtn = document.getElementById('closePlanningManualSelectModal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.remove('active');
                    if (window.ungreyOtherWheels) {
                        window.ungreyOtherWheels();
                    }
                });
            }
            
            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    if (window.ungreyOtherWheels) {
                        window.ungreyOtherWheels();
                    }
                }
            });
            
            // Setup Use button
            const useBtn = document.getElementById('planningManualUseBtn');
            if (useBtn) {
                useBtn.addEventListener('click', () => {
                    if (!window.currentManualSelectPaletteColor || !currentManualSelectedPaint) {
                        return;
                    }
                    
                    // Assign the selected paint to the palette color
                    setColorMapping(window.currentManualSelectPaletteColor.hex, currentManualSelectedPaint);
                    
                    // Close modal
                    modal.classList.remove('active');
                    if (window.ungreyOtherWheels) {
                        window.ungreyOtherWheels();
                    }
                    
                    // Update planning table
                    if (window.updatePlanningTable) {
                        window.updatePlanningTable();
                    }
                });
            }
        }
        
        // Show palette color box
        const paletteColorBox = document.getElementById('planningManualPaletteColorBox');
        if (paletteColorBox && paletteColor) {
            paletteColorBox.style.display = 'block';
            paletteColorBox.style.backgroundColor = paletteColor.hex;
        } else if (paletteColorBox) {
            paletteColorBox.style.display = 'none';
        }
        
        // Hide selected paint color box initially
        const selectedColorBox = document.getElementById('planningManualSelectedColorBox');
        if (selectedColorBox) {
            selectedColorBox.style.display = 'none';
        }
        
        // Hide Use button initially
        const useBtn = document.getElementById('planningManualUseBtn');
        if (useBtn) {
            useBtn.style.display = 'none';
        }
        
        // Create filters if needed
        const filterContainer = document.getElementById('planningManualSelectFilters');
        if (filterContainer) {
            filterContainer.innerHTML = '';
            createFilterCheckboxes('planningManualSelectFilters');
        }
        
        // Show modal first, then load table (so modal.classList.contains('active') check works)
        modal.classList.add('active');
        if (window.greyOutOtherWheels) {
            window.greyOutOtherWheels();
        }
        
        // Load table after modal is shown
        loadManualSelectTable();
        
        // Show color select wheel if available
        if (window.showColorSelectWheel) {
            window.showColorSelectWheel();
        }
    }
    
    // Helper function to create edit mode mixing cell
    function createEditModeMixingCell(color, candidate1Match, candidate2Match, fromAllMatch, mapping) {
        const cell = document.createElement('td');
        cell.className = 'planning-mixing-cell';
        cell.style.position = 'relative';
        
        const mixingScheme = isMixingScheme(mapping) ? mapping : null;
        
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
    if (dependencies.loadPalette) {
        loadPalette = dependencies.loadPalette;
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
    const mappings = getPalleteWithMappings();
    
    let newMode = 'edit'; // Default to edit
    
    // Check if there's at least one mapping
    const hasMapping = Object.keys(mappings).some(colorHex => {
        const mappingItem = mappings[colorHex];
        return mappingItem && mappingItem.mapping !== null;
    });
    
    if (hasMapping) {
        newMode = 'view';
    }
    
    const oldMode = getPlanningMode();
    // Set the mode - this will automatically trigger callbacks if mode changed
    setPlanningMode(newMode);
    
    // If mode didn't change, we still need to load the table
    if (oldMode === newMode) {
        loadPlanningTable();
    }
}

// Initialize planning add color modal
function initPlanningAddColorModal() {
    const modal = document.getElementById('planningAddColorModal');
    const addBtn = document.getElementById('planningAddBtn');
    const paletteEditorAddBtn = document.getElementById('paletteEditorAddBtn');
    const closeBtn = document.getElementById('closePlanningAddColorModal');
    const canvas = document.getElementById('planningAddColorWheelCanvas');
    const valueSlider = document.getElementById('planningValueSlider');
    const valueDisplay = document.getElementById('planningValueDisplay');
    const colorPreview = document.getElementById('planningColorPreview');
    const useBtn = document.getElementById('planningUseColorBtn');
    
    if (!modal || !closeBtn || !canvas || !valueSlider || !valueDisplay || !colorPreview || !useBtn) {
        return;
    }
    
    // Either button can open the modal
    if (!addBtn && !paletteEditorAddBtn) {
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
    
    // Function to open modal
    const openModal = () => {
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
    };
    
    // Open modal from Planning tab button
    if (addBtn) {
        addBtn.addEventListener('click', openModal);
    }
    
    // Open modal from Palette Editor button
    if (paletteEditorAddBtn) {
        paletteEditorAddBtn.addEventListener('click', openModal);
    }
    
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

