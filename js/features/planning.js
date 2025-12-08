/**
 * Planning feature - color matching and planning table
 */

import { rgbToHSV, hsvDistance, addGradientClickToColorBox, hexToRgb } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import { state, getPalette, getMyCollection, getMergedPaintColors } from '../core/state.js';
import { updateHeaderCount } from './myCollection.js';
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
    const thresholdValue = targetSaturation * (state.saturationThreshold / 100);

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
    const thresholdValue = targetSaturation * (state.saturationThreshold / 100);

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

// Find closest from my collection
export function findClosestFromMyCollection(targetColor, filterContainerId = null) {
    const myCollection = getMyCollection();
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
    const thresholdValue = targetSaturation * (state.saturationThreshold / 100);

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
    const myCollection = getMyCollection();
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
    const thresholdValue = targetSaturation * (state.saturationThreshold / 100);

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
export function findClosestFromPalette(targetColor) {
    const palette = getPalette();
    if (!palette || palette.length === 0) {
        return null;
    }

    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (state.saturationThreshold / 100);

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
export function findNthClosestFromPalette(targetColor, n) {
    const palette = getPalette();
    if (!palette || palette.length === 0) {
        return null;
    }

    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (state.saturationThreshold / 100);

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
            
            // Candidate column
            const candidateCell = document.createElement('td');
            const closestMatch = findClosestColor(color, 'merged', 'planningFilters');
            
            if (closestMatch) {
                const candidateColorBox = document.createElement('div');
                candidateColorBox.className = 'color-box';
                candidateColorBox.style.backgroundColor = closestMatch.hex;
                addGradientClickToColorBox(candidateColorBox, closestMatch.hex);
                
                candidateColorBox.dataset.colorName = closestMatch.name || '';
                candidateColorBox.dataset.colorType = Array.isArray(closestMatch.type) ? closestMatch.type.join(', ') : (closestMatch.type || '');
                candidateColorBox.dataset.colorProducer = closestMatch.producer || '';
                addHoverTooltipToColorBox(candidateColorBox);
                
                const candidateName = document.createElement('span');
                candidateName.className = 'candidate-name';
                candidateName.textContent = closestMatch.name || '';
                
                const candidateContainer = document.createElement('div');
                candidateContainer.className = 'candidate-container';
                candidateContainer.appendChild(candidateColorBox);
                
                const candidateNameWrapper = document.createElement('div');
                candidateNameWrapper.className = 'candidate-name-wrapper';
                candidateNameWrapper.appendChild(candidateName);
                
                if (closestMatch.type && Array.isArray(closestMatch.type) && closestMatch.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = closestMatch.type.join(', ');
                    candidateNameWrapper.appendChild(typeSpan);
                }
                
                candidateContainer.appendChild(candidateNameWrapper);
                candidateCell.appendChild(candidateContainer);
            } else {
                candidateCell.textContent = 'No match found';
            }
            
            row.appendChild(candidateCell);
            
            // Second Candidate column
            const secondCandidateCell = document.createElement('td');
            const secondClosestMatch = findNthClosestColor(color, 2, 'merged', 'planningFilters');
            
            if (secondClosestMatch) {
                const secondCandidateColorBox = document.createElement('div');
                secondCandidateColorBox.className = 'color-box';
                secondCandidateColorBox.style.backgroundColor = secondClosestMatch.hex;
                addGradientClickToColorBox(secondCandidateColorBox, secondClosestMatch.hex);
                
                secondCandidateColorBox.dataset.colorName = secondClosestMatch.name || '';
                secondCandidateColorBox.dataset.colorType = Array.isArray(secondClosestMatch.type) ? secondClosestMatch.type.join(', ') : (secondClosestMatch.type || '');
                secondCandidateColorBox.dataset.colorProducer = secondClosestMatch.producer || '';
                addHoverTooltipToColorBox(secondCandidateColorBox);
                
                const secondCandidateName = document.createElement('span');
                secondCandidateName.className = 'candidate-name';
                secondCandidateName.textContent = secondClosestMatch.name || '';
                
                const secondCandidateContainer = document.createElement('div');
                secondCandidateContainer.className = 'candidate-container';
                secondCandidateContainer.appendChild(secondCandidateColorBox);
                
                const secondCandidateNameWrapper = document.createElement('div');
                secondCandidateNameWrapper.className = 'candidate-name-wrapper';
                secondCandidateNameWrapper.appendChild(secondCandidateName);
                
                if (secondClosestMatch.type && Array.isArray(secondClosestMatch.type) && secondClosestMatch.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = secondClosestMatch.type.join(', ');
                    secondCandidateNameWrapper.appendChild(typeSpan);
                }
                
                secondCandidateContainer.appendChild(secondCandidateNameWrapper);
                secondCandidateCell.appendChild(secondCandidateContainer);
            } else {
                secondCandidateCell.textContent = 'No match found';
            }
            
            row.appendChild(secondCandidateCell);
            
            // Closest from My Collection column
            const myCollectionCandidateCell = document.createElement('td');
            const myCollectionMatch = findClosestFromMyCollection(color, 'planningFilters');
            
            if (myCollectionMatch) {
                const myCollectionColorBox = document.createElement('div');
                myCollectionColorBox.className = 'color-box';
                myCollectionColorBox.style.backgroundColor = myCollectionMatch.hex;
                addGradientClickToColorBox(myCollectionColorBox, myCollectionMatch.hex);
                
                myCollectionColorBox.dataset.colorName = myCollectionMatch.name || '';
                myCollectionColorBox.dataset.colorType = Array.isArray(myCollectionMatch.type) ? myCollectionMatch.type.join(', ') : (myCollectionMatch.type || '');
                myCollectionColorBox.dataset.colorProducer = myCollectionMatch.producer || '';
                addHoverTooltipToColorBox(myCollectionColorBox);
                
                const myCollectionName = document.createElement('span');
                myCollectionName.className = 'candidate-name';
                myCollectionName.textContent = myCollectionMatch.name || 'Unnamed';
                
                const myCollectionContainer = document.createElement('div');
                myCollectionContainer.className = 'candidate-container';
                myCollectionContainer.appendChild(myCollectionColorBox);
                
                const myCollectionNameWrapper = document.createElement('div');
                myCollectionNameWrapper.className = 'candidate-name-wrapper';
                myCollectionNameWrapper.appendChild(myCollectionName);
                
                if (myCollectionMatch.type && Array.isArray(myCollectionMatch.type) && myCollectionMatch.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = myCollectionMatch.type.join(', ');
                    myCollectionNameWrapper.appendChild(typeSpan);
                }
                
                myCollectionContainer.appendChild(myCollectionNameWrapper);
                myCollectionCandidateCell.appendChild(myCollectionContainer);
            } else {
                myCollectionCandidateCell.textContent = 'No match found';
            }
            
            row.appendChild(myCollectionCandidateCell);
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

