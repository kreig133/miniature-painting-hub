/**
 * Planning feature - color matching and planning table
 */

import { rgbToHSV, hsvDistance, addGradientClickToColorBox, hexToRgb } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import { state, getPalette, getMyCollection, getMergedPaintColors } from '../core/state.js';
import { updateHeaderCount, getEffectiveMyCollection } from './myCollection.js';
import { filterData } from './filters.js';

// Dependencies
let saveSortOrder = null;
let setSortOrder = null;
let sortPaletteByHSV = null;
let savePalette = null;
let loadPalette = null;

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

// Find closest from Paint Colours (wrapper for findClosestColor)
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

// Load planning table
export function loadPlanningTable() {
    const planningTable = document.getElementById('planningTable');
    if (!planningTable) return;

    const tbody = planningTable.querySelector('tbody');
    if (!tbody) return;

    function updatePlanningTable() {
        tbody.innerHTML = '';

        const palette = getPalette();
        if (palette.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'No colors in palette yet. Add colors from the Color Picker tab.';
            row.appendChild(cell);
            tbody.appendChild(row);
            updateHeaderCount('planningHeader', 0, 0);
            return;
        }
        
        updateHeaderCount('planningHeader', palette.length, palette.length);

        palette.forEach(color => {
            const row = document.createElement('tr');
            
            // Colour column
            const colorCell = document.createElement('td');
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = color.hex;
            addGradientClickToColorBox(colorBox, color.hex);
            colorCell.appendChild(colorBox);
            row.appendChild(colorCell);
            
            // Candidate 1 column (from My Collection)
            const candidate1Cell = document.createElement('td');
            const candidate1Match = findClosestFromMyCollection(color, 'planningFilters');
            
            if (candidate1Match) {
                const candidate1ColorBox = document.createElement('div');
                candidate1ColorBox.className = 'color-box';
                candidate1ColorBox.style.backgroundColor = candidate1Match.hex;
                addGradientClickToColorBox(candidate1ColorBox, candidate1Match.hex);
                
                candidate1ColorBox.dataset.colorName = candidate1Match.name || '';
                candidate1ColorBox.dataset.colorType = Array.isArray(candidate1Match.type) ? candidate1Match.type.join(', ') : (candidate1Match.type || '');
                candidate1ColorBox.dataset.colorProducer = candidate1Match.producer || '';
                addHoverTooltipToColorBox(candidate1ColorBox);
                
                const candidate1Name = document.createElement('span');
                candidate1Name.className = 'candidate-name';
                candidate1Name.textContent = candidate1Match.name || '';
                
                const candidate1Container = document.createElement('div');
                candidate1Container.className = 'candidate-container';
                candidate1Container.appendChild(candidate1ColorBox);
                
                const candidate1NameWrapper = document.createElement('div');
                candidate1NameWrapper.className = 'candidate-name-wrapper';
                candidate1NameWrapper.appendChild(candidate1Name);
                
                if (candidate1Match.type && Array.isArray(candidate1Match.type) && candidate1Match.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = candidate1Match.type.join(', ');
                    candidate1NameWrapper.appendChild(typeSpan);
                }
                
                candidate1Container.appendChild(candidate1NameWrapper);
                candidate1Cell.appendChild(candidate1Container);
            } else {
                candidate1Cell.textContent = 'No match found';
            }
            
            row.appendChild(candidate1Cell);
            
            // Candidate 2 column (from My Collection)
            const candidate2Cell = document.createElement('td');
            const candidate2Match = findNthClosestFromMyCollection(color, 2, 'planningFilters');
            
            if (candidate2Match) {
                const candidate2ColorBox = document.createElement('div');
                candidate2ColorBox.className = 'color-box';
                candidate2ColorBox.style.backgroundColor = candidate2Match.hex;
                addGradientClickToColorBox(candidate2ColorBox, candidate2Match.hex);
                
                candidate2ColorBox.dataset.colorName = candidate2Match.name || '';
                candidate2ColorBox.dataset.colorType = Array.isArray(candidate2Match.type) ? candidate2Match.type.join(', ') : (candidate2Match.type || '');
                candidate2ColorBox.dataset.colorProducer = candidate2Match.producer || '';
                addHoverTooltipToColorBox(candidate2ColorBox);
                
                const candidate2Name = document.createElement('span');
                candidate2Name.className = 'candidate-name';
                candidate2Name.textContent = candidate2Match.name || '';
                
                const candidate2Container = document.createElement('div');
                candidate2Container.className = 'candidate-container';
                candidate2Container.appendChild(candidate2ColorBox);
                
                const candidate2NameWrapper = document.createElement('div');
                candidate2NameWrapper.className = 'candidate-name-wrapper';
                candidate2NameWrapper.appendChild(candidate2Name);
                
                if (candidate2Match.type && Array.isArray(candidate2Match.type) && candidate2Match.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = candidate2Match.type.join(', ');
                    candidate2NameWrapper.appendChild(typeSpan);
                }
                
                candidate2Container.appendChild(candidate2NameWrapper);
                candidate2Cell.appendChild(candidate2Container);
            } else {
                candidate2Cell.textContent = 'No match found';
            }
            
            row.appendChild(candidate2Cell);
            
            // From All column (from Paint Colours)
            const fromAllCell = document.createElement('td');
            const fromAllMatch = findClosestFromPaintColors(color, 'planningFilters');
            
            if (fromAllMatch) {
                const fromAllColorBox = document.createElement('div');
                fromAllColorBox.className = 'color-box';
                fromAllColorBox.style.backgroundColor = fromAllMatch.hex;
                addGradientClickToColorBox(fromAllColorBox, fromAllMatch.hex);
                
                fromAllColorBox.dataset.colorName = fromAllMatch.name || '';
                fromAllColorBox.dataset.colorType = Array.isArray(fromAllMatch.type) ? fromAllMatch.type.join(', ') : (fromAllMatch.type || '');
                fromAllColorBox.dataset.colorProducer = fromAllMatch.producer || '';
                addHoverTooltipToColorBox(fromAllColorBox);
                
                const fromAllName = document.createElement('span');
                fromAllName.className = 'candidate-name';
                fromAllName.textContent = fromAllMatch.name || '';
                
                const fromAllContainer = document.createElement('div');
                fromAllContainer.className = 'candidate-container';
                fromAllContainer.appendChild(fromAllColorBox);
                
                const fromAllNameWrapper = document.createElement('div');
                fromAllNameWrapper.className = 'candidate-name-wrapper';
                fromAllNameWrapper.appendChild(fromAllName);
                
                if (fromAllMatch.type && Array.isArray(fromAllMatch.type) && fromAllMatch.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = fromAllMatch.type.join(', ');
                    fromAllNameWrapper.appendChild(typeSpan);
                }
                
                fromAllContainer.appendChild(fromAllNameWrapper);
                fromAllCell.appendChild(fromAllContainer);
            } else {
                fromAllCell.textContent = 'No match found';
            }
            
            row.appendChild(fromAllCell);
            tbody.appendChild(row);
        });
    }

    // Initial load
    updatePlanningTable();

    // Store globally for other modules to call
    window.updatePlanningTable = updatePlanningTable;
    
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

// Initialize planning module
export function initPlanning(dependencies = {}) {
    initSortOrder(dependencies);
    initSaturationThreshold();
    loadPlanningTable();
}

