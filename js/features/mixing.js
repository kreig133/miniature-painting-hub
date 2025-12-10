/**
 * Mixing Colour feature - generates and displays color pairs from My Collection
 */

import { getMyCollection } from '../core/state.js';
import { getEffectiveMyCollection } from './myCollection.js';
import { filterData } from './filters.js';
import { addGradientClickToColorBox, hexToRgb, rgbToHex } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import mixbox from 'https://scrtwpns.com/mixbox.esm.js';

// Generate all unique pairs from My Collection
function generateColorPairs(filterContainerId = null) {
    let myCollection = getEffectiveMyCollection();
    
    // Apply filters if filter container ID is provided
    if (filterContainerId && filterData) {
        myCollection = filterData(myCollection, filterContainerId);
    }
    
    const pairs = [];
    
    // Generate all pairs in both directions
    // Only filter out pairs where colors are exactly the same (same index or same hex value)
    // Keep all other pairs, including reverse pairs (A-B and B-A)
    for (let i = 0; i < myCollection.length; i++) {
        for (let j = 0; j < myCollection.length; j++) {
            // Only exclude pairs where colors are exactly the same (same index or same hex)
            if (i !== j) {
                const color1Hex = myCollection[i].hex?.toLowerCase().trim();
                const color2Hex = myCollection[j].hex?.toLowerCase().trim();
                
                // Keep all pairs except those with exactly the same hex color
                if (color1Hex && color2Hex && color1Hex !== color2Hex) {
                    pairs.push({
                        color1: myCollection[i],
                        color2: myCollection[j]
                    });
                }
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
                    
                    const resultBox = document.createElement('div');
                    resultBox.className = 'color-box';
                    resultBox.style.backgroundColor = resultHex;
                    resultBox.style.display = 'inline-block';
                    resultBox.style.verticalAlign = 'middle';
                    addGradientClickToColorBox(resultBox, resultHex);
                    resultCell.appendChild(resultBox);
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
}

// Initialize mixing feature
export function initMixing(dependencies = {}) {
    // Load initial mixing table
    loadMixingTable('mixingFilters');
}

