/**
 * Mixing Color feature - generates and displays color pairs from My Collection
 */

import { getMyCollection, getMergedPaintColors, getPalette } from '../core/state.js';
import { getEffectiveMyCollection } from './myCollection.js';
import { filterData, createFilterCheckboxes } from './filters.js';
import { addGradientClickToColorBox, hexToRgb, rgbToHex, rgbToHSV } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import mixbox from 'https://scrtwpns.com/mixbox.esm.js';

// Dependencies
let addColorToPalette = null;

// Generate all unique pairs from My Collection
// Filters only affect Color 1, Color 2 uses the full unfiltered collection
function generateColorPairs(filterContainerId = null) {
    const fullCollection = getEffectiveMyCollection();
    
    // Get filtered collection for Color 1 only
    let filteredCollection1 = fullCollection;
    if (filterContainerId && filterData) {
        filteredCollection1 = filterData(fullCollection, filterContainerId);
    }
    
    // Color 2 always uses the full unfiltered collection
    const collection2 = fullCollection;
    
    const pairs = [];
    
    // Generate pairs where Color 1 comes from filtered collection and Color 2 from full collection
    // Generate all pairs in both directions, but only filter Color 1
    for (let i = 0; i < filteredCollection1.length; i++) {
        for (let j = 0; j < collection2.length; j++) {
            // Only exclude pairs where colors are exactly the same (same hex value)
            const color1Hex = filteredCollection1[i].hex?.toLowerCase().trim();
            const color2Hex = collection2[j].hex?.toLowerCase().trim();
            
            // Keep all pairs except those with exactly the same hex color
            if (color1Hex && color2Hex && color1Hex !== color2Hex) {
                pairs.push({
                    color1: filteredCollection1[i],
                    color2: collection2[j]
                });
            }
        }
    }
    
    return pairs;
}

// Load and display color pairs
export function loadMixingTable(filterContainerId = null) {
    const mixingTable = document.getElementById('mixingTable');
    if (!mixingTable) return;
    
    const tbody = mixingTable.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const pairs = generateColorPairs(filterContainerId);
    
    if (pairs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #666;">No color pairs available. Add at least 2 different colors to My Collection.</td></tr>';
        return;
    }
    
    pairs.forEach((pair, index) => {
        const row = document.createElement('tr');
        row.className = 'mixing-row';
        
        // Color 1 cell
        const color1Cell = document.createElement('td');
        color1Cell.style.verticalAlign = 'middle';
        
        const color1Box = document.createElement('div');
        color1Box.className = 'color-box';
        color1Box.style.backgroundColor = pair.color1.hex;
        color1Box.style.display = 'inline-block';
        color1Box.style.verticalAlign = 'middle';
        color1Cell.appendChild(color1Box);
        
        const color1Info = document.createElement('div');
        color1Info.style.display = 'inline-block';
        color1Info.style.verticalAlign = 'middle';
        color1Info.style.marginLeft = '10px';
        
        const color1Name = document.createElement('span');
        color1Name.className = 'paint-name';
        color1Name.textContent = pair.color1.name || pair.color1.hex;
        color1Info.appendChild(color1Name);
        
        // Add type if available
        if (pair.color1.type && Array.isArray(pair.color1.type) && pair.color1.type.length > 0) {
            const color1Type = document.createElement('span');
            color1Type.className = 'paint-type';
            color1Type.textContent = pair.color1.type.join(', ');
            color1Info.appendChild(color1Type);
        }
        
        color1Cell.appendChild(color1Info);
        
        // Store color data for tooltip
        if (pair.color1.name || pair.color1.producer) {
            color1Box.dataset.colorName = pair.color1.name || '';
            color1Box.dataset.colorType = Array.isArray(pair.color1.type) ? pair.color1.type.join(', ') : (pair.color1.type || '');
            color1Box.dataset.colorProducer = pair.color1.producer || '';
            addHoverTooltipToColorBox(color1Box);
        }
        
        addGradientClickToColorBox(color1Box, pair.color1.hex);
        
        // Color 2 cell
        const color2Cell = document.createElement('td');
        color2Cell.style.verticalAlign = 'middle';
        
        const color2Box = document.createElement('div');
        color2Box.className = 'color-box';
        color2Box.style.backgroundColor = pair.color2.hex;
        color2Box.style.display = 'inline-block';
        color2Box.style.verticalAlign = 'middle';
        color2Cell.appendChild(color2Box);
        
        const color2Info = document.createElement('div');
        color2Info.style.display = 'inline-block';
        color2Info.style.verticalAlign = 'middle';
        color2Info.style.marginLeft = '10px';
        
        const color2Name = document.createElement('span');
        color2Name.className = 'paint-name';
        color2Name.textContent = pair.color2.name || pair.color2.hex;
        color2Info.appendChild(color2Name);
        
        // Add type if available
        if (pair.color2.type && Array.isArray(pair.color2.type) && pair.color2.type.length > 0) {
            const color2Type = document.createElement('span');
            color2Type.className = 'paint-type';
            color2Type.textContent = pair.color2.type.join(', ');
            color2Info.appendChild(color2Type);
        }
        
        color2Cell.appendChild(color2Info);
        
        // Store color data for tooltip
        if (pair.color2.name || pair.color2.producer) {
            color2Box.dataset.colorName = pair.color2.name || '';
            color2Box.dataset.colorType = Array.isArray(pair.color2.type) ? pair.color2.type.join(', ') : (pair.color2.type || '');
            color2Box.dataset.colorProducer = pair.color2.producer || '';
            addHoverTooltipToColorBox(color2Box);
        }
        
        addGradientClickToColorBox(color2Box, pair.color2.hex);
        
        // Result cell - calculate mixed color
        const resultCell = document.createElement('td');
        resultCell.style.verticalAlign = 'middle';
        
        // Convert hex colors to RGB for mixbox
        const rgb1 = hexToRgb(pair.color1.hex);
        const rgb2 = hexToRgb(pair.color2.hex);
        
        if (rgb1 && rgb2) {
            const t = 0.5; // 50/50 mixing ratio
            
            // Calculate mixed color using mixbox
            // mixbox.lerp typically accepts RGB arrays and returns an array
            try {
                const resultRgb = mixbox.lerp([rgb1.r, rgb1.g, rgb1.b], [rgb2.r, rgb2.g, rgb2.b], t);
                
                // Handle different return types
                let resultR, resultG, resultB;
                
                if (Array.isArray(resultRgb)) {
                    // Array format: [r, g, b]
                    resultR = Math.round(resultRgb[0]);
                    resultG = Math.round(resultRgb[1]);
                    resultB = Math.round(resultRgb[2]);
                } else if (typeof resultRgb === 'string') {
                    // String format: "rgb(r, g, b)"
                    const resultMatch = resultRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                    if (resultMatch) {
                        resultR = parseInt(resultMatch[1]);
                        resultG = parseInt(resultMatch[2]);
                        resultB = parseInt(resultMatch[3]);
                    }
                } else if (resultRgb && typeof resultRgb === 'object') {
                    // Object format: {r, g, b} or similar
                    resultR = Math.round(resultRgb.r || resultRgb[0] || 0);
                    resultG = Math.round(resultRgb.g || resultRgb[1] || 0);
                    resultB = Math.round(resultRgb.b || resultRgb[2] || 0);
                }
                
                if (resultR !== undefined && resultG !== undefined && resultB !== undefined) {
                    // Clamp values to valid RGB range
                    resultR = Math.max(0, Math.min(255, resultR));
                    resultG = Math.max(0, Math.min(255, resultG));
                    resultB = Math.max(0, Math.min(255, resultB));
                    
                    const resultHex = rgbToHex(resultR, resultG, resultB);
                    
                    // Check if color is already in palette
                    const palette = getPalette();
                    const isColorInPalette = palette.some(color => color.hex.toLowerCase() === resultHex.toLowerCase());
                    
                    // Create container for result box and add button
                    const resultContainer = document.createElement('div');
                    resultContainer.style.position = 'relative';
                    resultContainer.style.display = 'inline-block';
                    resultContainer.style.verticalAlign = 'middle';
                    
                    const resultBox = document.createElement('div');
                    resultBox.className = 'color-box';
                    resultBox.style.backgroundColor = resultHex;
                    resultBox.style.display = 'inline-block';
                    resultBox.style.verticalAlign = 'middle';
                    addGradientClickToColorBox(resultBox, resultHex);
                    resultContainer.appendChild(resultBox);
                    
                    // Add "+" button (only if color is not already in palette)
                    if (!isColorInPalette) {
                        const addToPaletteBtn = document.createElement('button');
                    addToPaletteBtn.className = 'mixing-add-to-palette-btn';
                    addToPaletteBtn.type = 'button';
                    addToPaletteBtn.title = 'Add to palette';
                    addToPaletteBtn.style.display = 'none';
                    addToPaletteBtn.style.position = 'absolute';
                    addToPaletteBtn.style.top = '50%';
                    addToPaletteBtn.style.left = '50%';
                    addToPaletteBtn.style.transform = 'translate(-50%, -50%)';
                    addToPaletteBtn.style.width = '28px';
                    addToPaletteBtn.style.height = '28px';
                    addToPaletteBtn.style.borderRadius = '50%';
                    addToPaletteBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    addToPaletteBtn.style.color = 'white';
                    addToPaletteBtn.style.border = 'none';
                    addToPaletteBtn.style.cursor = 'pointer';
                    addToPaletteBtn.style.zIndex = '10';
                    addToPaletteBtn.style.alignItems = 'center';
                    addToPaletteBtn.style.justifyContent = 'center';
                    addToPaletteBtn.style.padding = '0';
                    addToPaletteBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    `;
                    
                    // Show button on hover over container
                    resultContainer.addEventListener('mouseenter', () => {
                        addToPaletteBtn.style.display = 'flex';
                        addToPaletteBtn.style.alignItems = 'center';
                        addToPaletteBtn.style.justifyContent = 'center';
                    });
                    resultContainer.addEventListener('mouseleave', () => {
                        addToPaletteBtn.style.display = 'none';
                    });
                    
                    // Handle click to add to palette
                    addToPaletteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        
                        if (!addColorToPalette) {
                            console.error('addColorToPalette not available');
                            return;
                        }
                        
                        // Create color object for the result
                        const resultColor = {
                            hex: resultHex,
                            r: resultR,
                            g: resultG,
                            b: resultB,
                            name: `Mix: ${pair.color1.name || pair.color1.hex} + ${pair.color2.name || pair.color2.hex}`,
                            type: [],
                            producer: 'Mixed'
                        };
                        
                        // Add color to palette
                        if (addColorToPalette(resultColor)) {
                            // Create mixing scheme (50/50 mix)
                            const mixingScheme = {
                                colors: [pair.color1, pair.color2],
                                coefficients: [1, 1], // 50/50 mix (normalized to 1:1)
                                resultHex: resultHex
                            };
                            
                            // Save mixing scheme
                            const { saveMixingScheme } = await import('../features/planning.js');
                            if (saveMixingScheme) {
                                saveMixingScheme(resultHex, mixingScheme);
                            }
                        }
                    });
                        
                        resultContainer.appendChild(addToPaletteBtn);
                    }
                    
                    resultCell.appendChild(resultContainer);
                }
            } catch (error) {
                console.error('Error mixing colors:', error, rgb1, rgb2);
            }
        }
        
        row.appendChild(color1Cell);
        row.appendChild(color2Cell);
        row.appendChild(resultCell);
        tbody.appendChild(row);
    });
    
    // Add footer with icon legend
    const tfoot = mixingTable.querySelector('tfoot');
    if (tfoot) {
        tfoot.remove();
    }
    const newTfoot = document.createElement('tfoot');
    const footerRow = document.createElement('tr');
    const footerCell = document.createElement('td');
    footerCell.colSpan = 3; // Color 1, Color 2, Result
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
    
    // Add "+" icon legend
    const addIconLegend = document.createElement('div');
    addIconLegend.style.display = 'flex';
    addIconLegend.style.alignItems = 'center';
    addIconLegend.style.gap = '8px';
    
    const addIconLegendCircle = document.createElement('div');
    addIconLegendCircle.style.width = '28px';
    addIconLegendCircle.style.height = '28px';
    addIconLegendCircle.style.borderRadius = '50%';
    addIconLegendCircle.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    addIconLegendCircle.style.display = 'flex';
    addIconLegendCircle.style.alignItems = 'center';
    addIconLegendCircle.style.justifyContent = 'center';
    addIconLegendCircle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    
    addIconLegend.appendChild(addIconLegendCircle);
    
    const addIconText = document.createElement('span');
    addIconText.textContent = 'Add color to Palette with mixing formula';
    addIconLegend.appendChild(addIconText);
    
    legendContainer.appendChild(addIconLegend);
    
    footerCell.appendChild(legendContainer);
    footerRow.appendChild(footerCell);
    newTfoot.appendChild(footerRow);
    mixingTable.appendChild(newTfoot);
}

// Custom Mix functionality
let selectedColorIndex = null; // Track which color square is being edited
let selectedColors = [null, null, null, null];
let colorWeights = [1, 1, 1, 1]; // Default weight of 1
let updateCustomMixDisplay = null;
let updateResultColor = null;
let currentPaletteColor = null; // Track the palette color this mix is for

// Calculate GCD (Greatest Common Divisor) of two numbers
function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

// Calculate GCD of multiple numbers
function gcdArray(numbers) {
    if (numbers.length === 0) return 1;
    let result = numbers[0];
    for (let i = 1; i < numbers.length; i++) {
        result = gcd(result, numbers[i]);
    }
    return result;
}

// Normalize coefficients by dividing by GCD
function normalizeCoefficients(weights) {
    if (weights.length === 0) return [];
    const commonDivisor = gcdArray(weights);
    if (commonDivisor === 0) return weights; // Avoid division by zero
    return weights.map(w => w / commonDivisor);
}

// Calculate mix result color
function calculateMixResult(activeColors, activeWeights) {
    if (activeColors.length === 0) return [128, 128, 128];
    
    if (activeColors.length === 1) {
        const rgb = hexToRgb(activeColors[0].hex);
        if (rgb) {
            return [rgb.r, rgb.g, rgb.b];
        }
        return [128, 128, 128];
    }
    
    // For 2+ colors, use weighted mixbox
    let currentRgb = hexToRgb(activeColors[0].hex);
    if (!currentRgb) return [128, 128, 128];
    
    let currentWeight = activeWeights[0];
    
    // Mix with remaining colors one by one
    for (let i = 1; i < activeColors.length; i++) {
        const nextRgb = hexToRgb(activeColors[i].hex);
        if (!nextRgb) continue;
        
        const totalWeight = currentWeight + activeWeights[i];
        const ratio = activeWeights[i] / totalWeight;
        
        try {
            const mixed = mixbox.lerp(
                [currentRgb.r, currentRgb.g, currentRgb.b],
                [nextRgb.r, nextRgb.g, nextRgb.b],
                ratio
            );
            
            if (Array.isArray(mixed)) {
                currentRgb = { r: mixed[0], g: mixed[1], b: mixed[2] };
            }
        } catch (e) {
            console.error('Error mixing colors:', e);
            // Fallback to weighted average
            currentRgb = {
                r: (currentRgb.r * currentWeight + nextRgb.r * activeWeights[i]) / totalWeight,
                g: (currentRgb.g * currentWeight + nextRgb.g * activeWeights[i]) / totalWeight,
                b: (currentRgb.b * currentWeight + nextRgb.b * activeWeights[i]) / totalWeight
            };
        }
        
        currentWeight = totalWeight;
    }
    
    return [currentRgb.r, currentRgb.g, currentRgb.b];
}

    // Open custom mix modal with pre-filled colors (for Planning tab)
export function openCustomMixModalWithColors(paletteColor, candidate1, candidate2, fromAll) {
    const customMixModal = document.getElementById('customMixModal');
    const paletteColorBox = document.getElementById('customMixPaletteColorBox');
    const useMixBtn = document.getElementById('useMixBtn');
    const addToPaletteBtn = document.getElementById('addToPaletteBtn');
    
    if (!customMixModal) return;
    
    // Store the palette color for the "Use" button
    currentPaletteColor = paletteColor;
    
    // Show palette color box
    if (paletteColorBox && paletteColor) {
        paletteColorBox.style.display = 'block';
        paletteColorBox.style.backgroundColor = paletteColor.hex;
    } else if (paletteColorBox) {
        paletteColorBox.style.display = 'none';
    }
    
    // Hide "Add to Palette" button when opened from Planning tab
    if (addToPaletteBtn) {
        addToPaletteBtn.style.display = 'none';
    }
    
    // Show "Use" button when opened from Planning tab
    if (useMixBtn && paletteColor) {
        useMixBtn.style.display = 'block';
    }
    
    // Reset and pre-fill colors
    selectedColors = [null, null, null, null];
    colorWeights = [1, 1, 1, 1];
    
    if (candidate1) {
        selectedColors[0] = candidate1;
    }
    if (candidate2) {
        selectedColors[1] = candidate2;
    }
    if (fromAll) {
        selectedColors[2] = fromAll;
    }
    // 4th slot remains empty
    
    // Update display and result
    if (updateCustomMixDisplay) {
        updateCustomMixDisplay();
    }
    if (updateResultColor) {
        updateResultColor();
    }
    
    // Grey out other wheels
    if (window.greyOutOtherWheels) {
        window.greyOutOtherWheels();
    }
    
    // Open modal
    customMixModal.classList.add('active');
}

// Open custom mix modal with saved mixing scheme (for editing existing scheme)
export function openCustomMixModalWithScheme(paletteColor, mixingScheme) {
    const customMixModal = document.getElementById('customMixModal');
    const paletteColorBox = document.getElementById('customMixPaletteColorBox');
    const useMixBtn = document.getElementById('useMixBtn');
    const addToPaletteBtn = document.getElementById('addToPaletteBtn');
    
    if (!customMixModal || !mixingScheme) return;
    
    // Store the palette color for the "Use" button
    currentPaletteColor = paletteColor;
    
    // Show palette color box
    if (paletteColorBox && paletteColor) {
        paletteColorBox.style.display = 'block';
        paletteColorBox.style.backgroundColor = paletteColor.hex;
    } else if (paletteColorBox) {
        paletteColorBox.style.display = 'none';
    }
    
    // Hide "Add to Palette" button when opened from Planning tab
    if (addToPaletteBtn) {
        addToPaletteBtn.style.display = 'none';
    }
    
    // Show "Use" button when opened from Planning tab
    if (useMixBtn && paletteColor) {
        useMixBtn.style.display = 'block';
    }
    
    // Reset arrays
    selectedColors = [null, null, null, null];
    colorWeights = [1, 1, 1, 1];
    
    // Load colors and coefficients from mixing scheme
    // Coefficients were normalized when saved, so use them directly (clamped to 1-10 range)
    if (mixingScheme.colors && mixingScheme.coefficients) {
        const coefficients = mixingScheme.coefficients;
        
        for (let i = 0; i < Math.min(mixingScheme.colors.length, 4); i++) {
            selectedColors[i] = mixingScheme.colors[i];
            // Use coefficient value directly, clamped to slider range (1-10)
            const sliderValue = Math.max(1, Math.min(10, Math.round(coefficients[i])));
            colorWeights[i] = sliderValue;
        }
    }
    
    // Update display and result
    if (updateCustomMixDisplay) {
        updateCustomMixDisplay();
    }
    if (updateResultColor) {
        updateResultColor();
    }
    
    // Grey out other wheels
    if (window.greyOutOtherWheels) {
        window.greyOutOtherWheels();
    }
    
    // Open modal
    customMixModal.classList.add('active');
}

// Initialize custom mix modal
function initCustomMixModal() {
    const customMixBtn = document.getElementById('customMixBtn');
    const customMixModal = document.getElementById('customMixModal');
    const closeCustomMixModal = document.getElementById('closeCustomMixModal');
    const addColorBtns = document.querySelectorAll('.add-color-btn');
    const colorSelectModal = document.getElementById('customMixColorSelectModal');
    const closeColorSelectModal = document.getElementById('closeColorSelectModal');
    const colorWeightSliders = document.querySelectorAll('.color-weight-slider');
    const paletteColorBox = document.getElementById('customMixPaletteColorBox');
    
    // Open custom mix modal
    const useMixBtn = document.getElementById('useMixBtn');
    const addToPaletteBtn = document.getElementById('addToPaletteBtn');
    
    if (customMixBtn) {
        customMixBtn.addEventListener('click', () => {
            if (customMixModal) {
                // Hide palette color box for regular mixing
                if (paletteColorBox) {
                    paletteColorBox.style.display = 'none';
                }
                // Hide "Use" button for regular mixing
                if (useMixBtn) {
                    useMixBtn.style.display = 'none';
                }
                // Show "Add to Palette" button for Mixing Color tab
                if (addToPaletteBtn) {
                    addToPaletteBtn.style.display = 'block';
                    addToPaletteBtn.disabled = true; // Initially disabled until colors are added
                }
                currentPaletteColor = null;
                // Reset all colors
                selectedColors.fill(null);
                colorWeights.fill(1);
                if (updateCustomMixDisplay) {
                    updateCustomMixDisplay();
                }
                if (updateResultColor) {
                    updateResultColor();
                }
                customMixModal.classList.add('active');
            }
        });
    }
    
    // Handle "Use" button click
    if (useMixBtn) {
        useMixBtn.addEventListener('click', () => {
            if (!currentPaletteColor) return;
            
            // Get active colors and weights
            const activeColors = [];
            const activeWeights = [];
            for (let i = 0; i < selectedColors.length; i++) {
                if (selectedColors[i] !== null) {
                    activeColors.push(selectedColors[i]);
                    activeWeights.push(colorWeights[i]);
                }
            }
            
            if (activeColors.length === 0) {
                alert('Please add at least one color to the mix');
                return;
            }
            
            // Normalize coefficients by dividing by GCD
            const normalizedWeights = normalizeCoefficients(activeWeights);
            
            // Calculate result color
            const resultRgb = calculateMixResult(activeColors, activeWeights);
            const resultHex = rgbToHex(Math.round(resultRgb[0]), Math.round(resultRgb[1]), Math.round(resultRgb[2]));
            
            // Save mixing scheme
            import('../features/planning.js').then(({ saveMixingScheme }) => {
                if (saveMixingScheme) {
                    saveMixingScheme(currentPaletteColor.hex, {
                        colors: activeColors,
                        coefficients: normalizedWeights,
                        resultHex: resultHex
                    });
                    
                    // Close modal
                    if (customMixModal) {
                        customMixModal.classList.remove('active');
                if (window.ungreyOtherWheels) {
                    window.ungreyOtherWheels();
                }
                    }
                    
                    // Reload planning table to show the new mixing scheme
                    // Preserve current mode (don't auto-switch to view mode)
                    import('../features/planning.js').then(({ loadPlanningTable }) => {
                        if (loadPlanningTable) {
                            loadPlanningTable(true); // Pass true to preserve current mode
                        }
                    });
                }
            }).catch(err => {
                console.error('Error saving mixing scheme:', err);
            });
        });
    }
    
    // Handle "Add to Palette" button click
    if (addToPaletteBtn) {
        addToPaletteBtn.addEventListener('click', async () => {
            if (!addColorToPalette) {
                console.error('addColorToPalette not available');
                return;
            }
            
            // Get active colors and weights
            const activeColors = [];
            const activeWeights = [];
            for (let i = 0; i < selectedColors.length; i++) {
                if (selectedColors[i] !== null) {
                    activeColors.push(selectedColors[i]);
                    activeWeights.push(colorWeights[i]);
                }
            }
            
            if (activeColors.length === 0) {
                return; // Button should be disabled, but check anyway
            }
            
            // Normalize coefficients by dividing by GCD
            const normalizedWeights = normalizeCoefficients(activeWeights);
            
            // Calculate result color
            const resultRgb = calculateMixResult(activeColors, activeWeights);
            const resultR = Math.round(resultRgb[0]);
            const resultG = Math.round(resultRgb[1]);
            const resultB = Math.round(resultRgb[2]);
            const resultHex = rgbToHex(resultR, resultG, resultB);
            
            // Create color object for the result
            const colorNames = activeColors.map(c => c.name || c.hex).join(' + ');
            const resultColor = {
                hex: resultHex,
                r: resultR,
                g: resultG,
                b: resultB,
                name: `Mix: ${colorNames}`,
                type: [],
                producer: 'Mixed'
            };
            
            // Add color to palette
            if (addColorToPalette(resultColor)) {
                // Create mixing scheme
                const mixingScheme = {
                    colors: activeColors,
                    coefficients: normalizedWeights,
                    resultHex: resultHex
                };
                
                // Save mixing scheme
                const { saveMixingScheme } = await import('./planning.js');
                if (saveMixingScheme) {
                    saveMixingScheme(resultHex, mixingScheme);
                }
                
                // Close modal
                if (customMixModal) {
                    customMixModal.classList.remove('active');
                    if (window.ungreyOtherWheels) {
                        window.ungreyOtherWheels();
                    }
                }
                
                // Reset all colors
                selectedColors.fill(null);
                colorWeights.fill(1);
                if (updateCustomMixDisplay) {
                    updateCustomMixDisplay();
                }
                if (updateResultColor) {
                    updateResultColor();
                }
                
                // Reload mixing table to show the new color in the palette
                loadMixingTable('mixingFilters');
            }
        });
    }
    
    // Close custom mix modal
    if (closeCustomMixModal) {
        closeCustomMixModal.addEventListener('click', () => {
            if (customMixModal) {
                customMixModal.classList.remove('active');
                if (window.ungreyOtherWheels) {
                    window.ungreyOtherWheels();
                }
            }
        });
    }
    
    // Close on background click
    if (customMixModal) {
        customMixModal.addEventListener('click', (e) => {
            if (e.target === customMixModal) {
                customMixModal.classList.remove('active');
                if (window.ungreyOtherWheels) {
                    window.ungreyOtherWheels();
                }
            }
        });
    }
    
    // Handle "Add color" button clicks
    addColorBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            selectedColorIndex = index;
            openColorSelectModal();
        });
    });
    
    // Close color select modal
    if (closeColorSelectModal) {
        closeColorSelectModal.addEventListener('click', () => {
            if (colorSelectModal) {
                colorSelectModal.classList.remove('active');
                hideColorSelectWheel();
                ungreyOtherWheels();
            }
        });
    }
    
    // Close color select modal on background click
    if (colorSelectModal) {
        colorSelectModal.addEventListener('click', (e) => {
            if (e.target === colorSelectModal) {
                colorSelectModal.classList.remove('active');
                hideColorSelectWheel();
                ungreyOtherWheels();
            }
        });
    }
    
    // Also close wheel on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && colorSelectModal && colorSelectModal.classList.contains('active')) {
            colorSelectModal.classList.remove('active');
            hideColorSelectWheel();
            ungreyOtherWheels();
        }
    });
    
    // Handle slider changes
    colorWeightSliders.forEach((slider, index) => {
        slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            colorWeights[index] = value;
            const valueDisplay = e.target.parentElement.querySelector('.slider-value');
            if (valueDisplay) {
                valueDisplay.textContent = value;
            }
            updateResultColor();
        });
    });
    
    // Handle remove button clicks using event delegation
    const customMixModalContent = document.querySelector('.custom-mix-modal-content');
    if (customMixModalContent) {
        customMixModalContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-color-btn') || e.target.closest('.remove-color-btn')) {
                const removeBtn = e.target.classList.contains('remove-color-btn') ? e.target : e.target.closest('.remove-color-btn');
                const colorDisplay = removeBtn.closest('.color-display');
                if (colorDisplay) {
                    const square = colorDisplay.closest('.custom-mix-color-square');
                    if (square) {
                        const index = parseInt(square.getAttribute('data-color-index'));
                        if (!isNaN(index)) {
                            e.stopPropagation();
                            // Remove color
                            selectedColors[index] = null;
                            colorWeights[index] = 1; // Reset weight to default
                            updateCustomMixDisplay();
                            updateResultColor();
                        }
                    }
                }
            }
        });
    }
    
    // Update display when colors are selected
    updateCustomMixDisplay = function() {
        addColorBtns.forEach((btn, index) => {
            const square = btn.closest('.custom-mix-color-square');
            const colorDisplay = square.querySelector('.color-display');
            const addColorBtn = square.querySelector('.add-color-btn');
            
            if (selectedColors[index]) {
                // Show color display
                addColorBtn.style.display = 'none';
                colorDisplay.style.display = 'flex';
                
                const colorBox = colorDisplay.querySelector('.color-display-box');
                const colorName = colorDisplay.querySelector('.color-display-name');
                const slider = colorDisplay.querySelector('.color-weight-slider');
                const sliderValue = colorDisplay.querySelector('.slider-value');
                const removeBtn = colorDisplay.querySelector('.remove-color-btn');
                
                if (colorBox) {
                    colorBox.style.backgroundColor = selectedColors[index].hex;
                }
                if (colorName) {
                    colorName.textContent = selectedColors[index].name || selectedColors[index].hex;
                }
                if (slider) {
                    slider.value = colorWeights[index];
                }
                if (sliderValue) {
                    sliderValue.textContent = colorWeights[index];
                }
            } else {
                // Show add color button
                addColorBtn.style.display = 'block';
                colorDisplay.style.display = 'none';
            }
        });
    }
    
    // Calculate and update result color
    updateResultColor = function() {
        const resultBox = document.getElementById('customMixResultBox');
        if (!resultBox) return;
        
        // Filter out null colors
        const activeColors = [];
        const activeWeights = [];
        for (let i = 0; i < selectedColors.length; i++) {
            if (selectedColors[i] !== null) {
                activeColors.push(selectedColors[i]);
                activeWeights.push(colorWeights[i]);
            }
        }
        
        // Update "Add to Palette" button state (before early return)
        const addToPaletteBtn = document.getElementById('addToPaletteBtn');
        if (addToPaletteBtn && addToPaletteBtn.style.display !== 'none') {
            // Enable button only if at least one color is added
            addToPaletteBtn.disabled = activeColors.length === 0;
        }
        
        if (activeColors.length === 0) {
            resultBox.style.backgroundColor = '#f5f5f5';
            return;
        }
        
        // Calculate weighted average using mixbox for color mixing
        // For 2 colors, use mixbox directly
        // For more colors, mix them in pairs using weighted approach
        let resultRgb = null;
        
        if (activeColors.length === 1) {
            const rgb = hexToRgb(activeColors[0].hex);
            if (rgb) {
                resultRgb = [rgb.r, rgb.g, rgb.b];
            }
        } else if (activeColors.length === 2) {
            // Mix 2 colors with weights
            const rgb1 = hexToRgb(activeColors[0].hex);
            const rgb2 = hexToRgb(activeColors[1].hex);
            if (rgb1 && rgb2) {
                const totalWeight = activeWeights[0] + activeWeights[1];
                const ratio = activeWeights[1] / totalWeight;
                
                try {
                    const mixed = mixbox.lerp(
                        [rgb1.r, rgb1.g, rgb1.b],
                        [rgb2.r, rgb2.g, rgb2.b],
                        ratio
                    );
                    
                    if (Array.isArray(mixed)) {
                        resultRgb = [mixed[0], mixed[1], mixed[2]];
                    }
                } catch (e) {
                    console.error('Error mixing colors:', e);
                    // Fallback to weighted average
                    resultRgb = [
                        (rgb1.r * activeWeights[0] + rgb2.r * activeWeights[1]) / totalWeight,
                        (rgb1.g * activeWeights[0] + rgb2.g * activeWeights[1]) / totalWeight,
                        (rgb1.b * activeWeights[0] + rgb2.b * activeWeights[1]) / totalWeight
                    ];
                }
            }
        } else {
            // For 3 or 4 colors, mix them sequentially
            // Start with first two colors
            let currentRgb = hexToRgb(activeColors[0].hex);
            if (!currentRgb) return;
            
            let currentWeight = activeWeights[0];
            
            // Mix with remaining colors one by one
            for (let i = 1; i < activeColors.length; i++) {
                const nextRgb = hexToRgb(activeColors[i].hex);
                if (!nextRgb) continue;
                
                const totalWeight = currentWeight + activeWeights[i];
                const ratio = activeWeights[i] / totalWeight;
                
                try {
                    const mixed = mixbox.lerp(
                        [currentRgb.r, currentRgb.g, currentRgb.b],
                        [nextRgb.r, nextRgb.g, nextRgb.b],
                        ratio
                    );
                    
                    if (Array.isArray(mixed)) {
                        currentRgb = { r: mixed[0], g: mixed[1], b: mixed[2] };
                    }
                } catch (e) {
                    console.error('Error mixing colors:', e);
                    // Fallback to weighted average
                    currentRgb = {
                        r: (currentRgb.r * currentWeight + nextRgb.r * activeWeights[i]) / totalWeight,
                        g: (currentRgb.g * currentWeight + nextRgb.g * activeWeights[i]) / totalWeight,
                        b: (currentRgb.b * currentWeight + nextRgb.b * activeWeights[i]) / totalWeight
                    };
                }
                
                currentWeight = totalWeight;
            }
            
            resultRgb = [currentRgb.r, currentRgb.g, currentRgb.b];
        }
        
        if (resultRgb) {
            const hex = rgbToHex(Math.round(resultRgb[0]), Math.round(resultRgb[1]), Math.round(resultRgb[2]));
            resultBox.style.backgroundColor = hex;
        }
    }
    
    // Open color selection modal
    function openColorSelectModal() {
        if (!colorSelectModal) {
            return;
        }
        
        // Grey out other wheels
        greyOutOtherWheels();
        
        // Create filters
        const filterContainer = document.getElementById('customMixColorSelectFilters');
        if (filterContainer) {
            createFilterCheckboxes('customMixColorSelectFilters');
        }
        
        // Load colors
        loadColorSelectTable();
        
        // Show floating color wheel on the right
        showColorSelectWheel();
        
        colorSelectModal.classList.add('active');
    }
    
    // Load color selection table
    function loadColorSelectTable() {
        const table = document.getElementById('customMixColorSelectTable');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Get all paint colors (merged)
        let colors = getMergedPaintColors();
        if (!colors || colors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No colors available</td></tr>';
            return;
        }
        
        // Apply filters
        const filterContainer = document.getElementById('customMixColorSelectFilters');
        if (filterContainer && filterData) {
            colors = filterData(colors, 'customMixColorSelectFilters');
        }
        
        if (colors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No colors match the filters</td></tr>';
            return;
        }
        
        colors.forEach(color => {
            const row = document.createElement('tr');
            row.className = 'color-select-row';
            
            // Color cell
            const colorCell = document.createElement('td');
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = color.hex;
            colorBox.style.width = '40px';
            colorBox.style.height = '40px';
            colorBox.style.display = 'inline-block';
            addGradientClickToColorBox(colorBox, color.hex);
            colorCell.appendChild(colorBox);
            row.appendChild(colorCell);
            
            // Name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = color.name || color.hex;
            row.appendChild(nameCell);
            
            // Type cell
            const typeCell = document.createElement('td');
            typeCell.textContent = Array.isArray(color.type) ? color.type.join(', ') : (color.type || '');
            row.appendChild(typeCell);
            
            // Producer cell
            const producerCell = document.createElement('td');
            producerCell.textContent = color.producer || '';
            row.appendChild(producerCell);
            
            // Add select button (shown on hover)
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
                // Select this color
                if (selectedColorIndex !== null) {
                    selectedColors[selectedColorIndex] = color;
                    updateCustomMixDisplay();
                    updateResultColor();
                    // Close modal and hide wheel
                    if (colorSelectModal) {
                        colorSelectModal.classList.remove('active');
                    }
                    hideColorSelectWheel();
                    ungreyOtherWheels();
                }
            });
            row.appendChild(selectBtn);
            
            // Add tooltip data
            colorBox.dataset.colorName = color.name || '';
            colorBox.dataset.colorType = Array.isArray(color.type) ? color.type.join(', ') : (color.type || '');
            colorBox.dataset.colorProducer = color.producer || '';
            addHoverTooltipToColorBox(colorBox);
            
            tbody.appendChild(row);
        });
    }
    
    // Show floating color wheel for color select
    function showColorSelectWheel() {
        const wheel = document.getElementById('floatingColorSelectWheel');
        if (!wheel) {
            console.error('floatingColorSelectWheel not found');
            return;
        }
        
        // Position on the right side of the screen and ensure it's on top
        wheel.style.display = 'block';
        wheel.style.position = 'fixed';
        wheel.style.top = '100px';
        wheel.style.right = '20px';
        wheel.style.left = 'auto';
        wheel.style.transform = 'none'; // Reset any previous transforms
        wheel.style.zIndex = '10002'; // Above modals (10000) and other wheels (9000)
        
        // Draw colors on the wheel if the function is available
        if (window.drawColorSelectWheelPoints) {
            window.drawColorSelectWheelPoints();
        } else {
            console.warn('drawColorSelectWheelPoints not available');
        }
    }
    
    // Hide floating color wheel
    function hideColorSelectWheel() {
        const wheel = document.getElementById('floatingColorSelectWheel');
        if (wheel) {
            wheel.style.display = 'none';
        }
    }
    
    // Grey out other floating wheels (expose globally)
    window.greyOutOtherWheels = function() {
        const wheels = [
            'floatingColorWheel',
            'floatingCollectionWheel',
            'floatingPaintColorsWheel'
        ];
        
        wheels.forEach(wheelId => {
            const wheel = document.getElementById(wheelId);
            if (wheel) {
                wheel.style.opacity = '0.3';
                wheel.style.pointerEvents = 'none';
            }
        });
    };
    
    // Restore other floating wheels (expose globally)
    window.ungreyOtherWheels = function() {
        const wheels = [
            'floatingColorWheel',
            'floatingCollectionWheel',
            'floatingPaintColorsWheel'
        ];
        
        wheels.forEach(wheelId => {
            const wheel = document.getElementById(wheelId);
            if (wheel) {
                wheel.style.opacity = '1';
                wheel.style.pointerEvents = 'auto';
            }
        });
    };
    
    // Expose update function for filter changes
    window.updateCustomMixColorSelectTable = () => {
        loadColorSelectTable();
        if (window.drawColorSelectWheelPoints) {
            window.drawColorSelectWheelPoints();
        }
    };
}

// Initialize mixing feature
export function initMixing(dependencies = {}) {
    if (dependencies.addColorToPalette) {
        addColorToPalette = dependencies.addColorToPalette;
    }
    
    // Load initial mixing table
    loadMixingTable('mixingFilters');
    
    // Initialize custom mix modal
    initCustomMixModal();
}

