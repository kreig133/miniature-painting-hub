/**
 * Paint Colors feature - manages paint color data and display
 */

import { addGradientClickToColorBox } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import { state, setMergedPaintColors, getMergedPaintColors } from '../core/state.js';
import { updateHeaderCount } from './myCollection.js';

let filterData = null;
let addToMyCollection = null;
let addToShoppingCart = null;

// Merge all paint color data sources into one array
export function mergePaintColorsData() {
    const mergedPaintColors = [];
    
    // Helper function to format name with code
    function formatName(item) {
        const name = item.name || item.name_en || '';
        if (item.code) {
            return `${name}(${item.code})`;
        }
        return name;
    }
    
    // Process Vallejo Model Colors
    if (typeof VALLEJO_MODEL_COLORS !== 'undefined' && VALLEJO_MODEL_COLORS && VALLEJO_MODEL_COLORS.length > 0) {
        VALLEJO_MODEL_COLORS.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'Vallejo'
            });
        });
    }
    
    // Process Vallejo Model Air Colors
    if (typeof VALLEJO_MODEL_AIR_COLORS !== 'undefined' && VALLEJO_MODEL_AIR_COLORS && VALLEJO_MODEL_AIR_COLORS.length > 0) {
        VALLEJO_MODEL_AIR_COLORS.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'Vallejo'
            });
        });
    }
    
    // Process Vallejo Game Color
    if (typeof VALLEJO_GAME_COLOR_DATA !== 'undefined' && VALLEJO_GAME_COLOR_DATA && VALLEJO_GAME_COLOR_DATA.length > 0) {
        VALLEJO_GAME_COLOR_DATA.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'Vallejo'
            });
        });
    }
    
    // Process Army Painter Speedpaint 2.0
    if (typeof ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS !== 'undefined' && ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS && ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS.length > 0) {
        ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS.forEach(item => {
            mergedPaintColors.push({
                name: item.name || '',
                hex: item.hex,
                type: item.type || [],
                producer: 'Army Painter'
            });
        });
    }
    
    // Process Army Painter Warpaints Fanatic
    if (typeof ARMY_PAINTER_WARPANTS_FANATIC_COLOURS !== 'undefined' && ARMY_PAINTER_WARPANTS_FANATIC_COLOURS && ARMY_PAINTER_WARPANTS_FANATIC_COLOURS.length > 0) {
        ARMY_PAINTER_WARPANTS_FANATIC_COLOURS.forEach(item => {
            mergedPaintColors.push({
                name: item.name || '',
                hex: item.hex,
                type: item.type || [],
                producer: 'Army Painter'
            });
        });
    }
    
    // Process AK Interactive 3rd Gen
    if (typeof AK_INTERACTIVE_3GEN_DATA !== 'undefined' && AK_INTERACTIVE_3GEN_DATA && AK_INTERACTIVE_3GEN_DATA.length > 0) {
        AK_INTERACTIVE_3GEN_DATA.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'AK'
            });
        });
    }
    
    // Process AK Interactive Quick Gen
    if (typeof AK_INTERACTIVE_QUICK_GEN !== 'undefined' && AK_INTERACTIVE_QUICK_GEN && AK_INTERACTIVE_QUICK_GEN.length > 0) {
        AK_INTERACTIVE_QUICK_GEN.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'AK'
            });
        });
    }
    
    setMergedPaintColors(mergedPaintColors);
    return mergedPaintColors;
}

// Get unique producers and types from merged data
export function getUniqueProducersAndTypes() {
    const mergedPaintColors = getMergedPaintColors();
    const producers = new Set();
    const types = new Set();
    
    mergedPaintColors.forEach(item => {
        if (item.producer) {
            producers.add(item.producer);
        }
        if (item.type && Array.isArray(item.type)) {
            item.type.forEach(type => types.add(type));
        } else if (item.type) {
            types.add(item.type);
        }
    });
    
    return {
        producers: Array.from(producers).sort(),
        types: Array.from(types).sort()
    };
}

// Load paint colors from merged data source
export function loadPaintColors() {
    const paintColorsTable = document.getElementById('paintColorsTable');
    if (!paintColorsTable) return;

    const tbody = paintColorsTable.querySelector('tbody');
    if (!tbody) return;

    const mergedPaintColors = getMergedPaintColors();

    // Use merged data source
    if (!mergedPaintColors || mergedPaintColors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No paint colors available. Please make sure data files are loaded.</td></tr>';
        updateHeaderCount('paintColorsHeader', 0, 0);
        return;
    }

    // Apply filters
    const filteredData = filterData ? filterData(mergedPaintColors, 'paintColorsFilters') : mergedPaintColors;
    
    // Update header count
    updateHeaderCount('paintColorsHeader', filteredData.length, mergedPaintColors.length);

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No colors match the selected filters.</td></tr>';
        return;
    }

    filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'collection-row';
        
        // Colour column
        const colorCell = document.createElement('td');
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = item.hex;
        
        // Store color data for tooltip
        colorBox.dataset.colorName = item.name || '';
        colorBox.dataset.colorType = Array.isArray(item.type) ? item.type.join(', ') : (item.type || '');
        colorBox.dataset.colorProducer = item.producer || '';
        addHoverTooltipToColorBox(colorBox);
        
        addGradientClickToColorBox(colorBox, item.hex);
        colorCell.appendChild(colorBox);
        
        // Name column
        const nameCell = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'paint-name';
        nameSpan.textContent = item.name || '';
        nameCell.appendChild(nameSpan);
        
        // Add type row
        if (item.type && Array.isArray(item.type) && item.type.length > 0) {
            const typeSpan = document.createElement('span');
            typeSpan.className = 'paint-type';
            typeSpan.textContent = item.type.join(', ');
            nameCell.appendChild(typeSpan);
        }
        
        // Add button column
        const addCell = document.createElement('td');
        addCell.className = 'add-button-cell';
        addCell.style.position = 'relative';
        
        // Add to My Collection button
        const addBtn = document.createElement('button');
        addBtn.className = 'add-to-collection-btn';
        addBtn.textContent = '+';
        addBtn.title = 'Add to My Collection';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Copy name as displayed (from the nameSpan element)
            const displayedName = nameSpan.textContent || '';
            
            const colorData = {
                name: displayedName,
                hex: item.hex,
                type: item.type || [],
                producer: item.producer || ''
            };
            if (addToMyCollection && addToMyCollection(colorData)) {
                addBtn.textContent = '✓';
                addBtn.classList.add('added');
                setTimeout(() => {
                    addBtn.textContent = '+';
                    addBtn.classList.remove('added');
                }, 1000);
            }
        });
        
        // Add to Shopping Cart button
        const cartBtn = document.createElement('button');
        cartBtn.className = 'add-to-cart-btn';
        cartBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
        `;
        cartBtn.title = 'Add to Shopping Cart';
        cartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Copy name as displayed (from the nameSpan element)
            const displayedName = nameSpan.textContent || '';
            
            const colorData = {
                name: displayedName,
                hex: item.hex,
                type: item.type || [],
                producer: item.producer || ''
            };
            if (addToShoppingCart && addToShoppingCart(colorData)) {
                cartBtn.classList.add('added');
                setTimeout(() => {
                    cartBtn.classList.remove('added');
                }, 1000);
            }
        });
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.appendChild(addBtn);
        buttonContainer.appendChild(cartBtn);
        addCell.appendChild(buttonContainer);
        
        row.appendChild(colorCell);
        row.appendChild(nameCell);
        row.appendChild(addCell);
        tbody.appendChild(row);
    });
}

// Initialize paint colors module
export function initPaintColors(dependencies = {}) {
    if (dependencies.filterData) {
        filterData = dependencies.filterData;
    }
    if (dependencies.addToMyCollection) {
        addToMyCollection = dependencies.addToMyCollection;
    }
    if (dependencies.addToShoppingCart) {
        addToShoppingCart = dependencies.addToShoppingCart;
    }
    
    // Merge data on init
    mergePaintColorsData();
    loadPaintColors();
}

