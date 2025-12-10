/**
 * My Collection feature - manages user's color collection
 */

import { saveMyCollection as saveMyCollectionToStorage, loadMyCollection as loadMyCollectionFromStorage, 
         saveUseShoppingColors, loadUseShoppingColors } from '../utils/storage.js';
import { addGradientClickToColorBox } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import { state, getMyCollection, setMyCollection, getShoppingCart } from '../core/state.js';

let drawCollectionPointsOnWheel = null;
let updatePlanningTable = null;
let updateClosestMatches = null;
let updateMixingTable = null;
let filterData = null;

// Get effective collection (merged with shopping if checkbox is checked)
export function getEffectiveMyCollection() {
    const myCollection = getMyCollection();
    const useShoppingColors = loadUseShoppingColors();
    
    if (!useShoppingColors) {
        return myCollection;
    }
    
    // Merge with shopping cart, avoiding duplicates
    const shoppingCart = getShoppingCart();
    const merged = [...myCollection];
    
    shoppingCart.forEach(shoppingItem => {
        // Check if already exists in myCollection
        const exists = merged.some(item => 
            item.hex === shoppingItem.hex && 
            item.name === shoppingItem.name &&
            item.producer === shoppingItem.producer
        );
        if (!exists) {
            merged.push(shoppingItem);
        }
    });
    
    return merged;
}

// Save myCollection to localStorage
export function saveMyCollection() {
    saveMyCollectionToStorage(getMyCollection());
}

// Add color to myCollection
export function addToMyCollection(colorData) {
    const myCollection = getMyCollection();
    
    // Check if color already exists (by hex and name)
    const exists = myCollection.some(item => 
        item.hex === colorData.hex && 
        item.name === colorData.name
    );
    
    if (!exists) {
        myCollection.push(colorData);
        setMyCollection(myCollection);
        saveMyCollection();
        loadMyCollection();
        
        // Update collection wheel
        if (drawCollectionPointsOnWheel) {
            drawCollectionPointsOnWheel();
        }
        
        // Update planning table if it exists
        if (updatePlanningTable) {
            updatePlanningTable();
        }
        
        // Update mixing table if it exists
        if (updateMixingTable) {
            updateMixingTable('mixingFilters');
        }
        
        // Update closest matches when collection changes
        if (state.currentColor && updateClosestMatches) {
            updateClosestMatches();
        }
        return true;
    }
    return false;
}

// Update header with count
export function updateHeaderCount(headerId, filteredCount, totalCount) {
    const header = document.getElementById(headerId);
    if (!header) return;
    
    // Extract base name (text before any existing count)
    const baseText = header.textContent.split(' (')[0];
    header.textContent = `${baseText} (${filteredCount}/${totalCount})`;
}

// Load My Collection
export function loadMyCollection() {
    const myCollectionTable = document.getElementById('myCollectionTable');
    if (!myCollectionTable) return;

    const tbody = myCollectionTable.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const myCollection = getMyCollection();

    if (myCollection.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No colors in collection yet. Add colors from Paint Colors tab.';
        row.appendChild(cell);
        tbody.appendChild(row);
        updateHeaderCount('myCollectionHeader', 0, 0);
        return;
    }

    // Apply filters
    const filteredCollection = filterData ? filterData(myCollection, 'myCollectionFilters') : myCollection;
    
    // Update header count
    updateHeaderCount('myCollectionHeader', filteredCollection.length, myCollection.length);

    if (filteredCollection.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No colors match the selected filters.';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    filteredCollection.forEach((item) => {
        const row = document.createElement('tr');
        row.className = 'collection-row';
        
        // Find the original index in myCollection
        const originalIndex = myCollection.findIndex(origItem => 
            origItem.hex === item.hex && 
            origItem.name === item.name &&
            origItem.producer === item.producer
        );
        
        // Colour column
        const colorCell = document.createElement('td');
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = item.hex;
        
        // Store color data for tooltip
        colorBox.dataset.colorName = item.name || 'Unnamed';
        colorBox.dataset.colorType = Array.isArray(item.type) ? item.type.join(', ') : (item.type || '');
        colorBox.dataset.colorProducer = item.producer || '';
        addHoverTooltipToColorBox(colorBox);
        
        addGradientClickToColorBox(colorBox, item.hex);
        colorCell.appendChild(colorBox);
        
        // Name column
        const nameCell = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'paint-name';
        nameSpan.textContent = item.name || 'Unnamed';
        nameCell.appendChild(nameSpan);
        
        // Add type row (italic, 2x smaller, same style as Paint Colors tab)
        if (item.type && Array.isArray(item.type) && item.type.length > 0) {
            const typeSpan = document.createElement('span');
            typeSpan.className = 'paint-type';
            typeSpan.textContent = item.type.join(', ');
            nameCell.appendChild(typeSpan);
        }
        
        // Producer column
        const producerCell = document.createElement('td');
        producerCell.textContent = item.producer || '';
        
        // Delete button column
        const deleteCell = document.createElement('td');
        deleteCell.className = 'delete-button-cell';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-from-collection-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove from My Collection';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Remove item from collection using original index
            if (originalIndex !== -1) {
                const myCollection = getMyCollection();
                myCollection.splice(originalIndex, 1);
                setMyCollection(myCollection);
                saveMyCollection();
                loadMyCollection();
                
                // Update planning table if it exists
                if (updatePlanningTable) {
                    updatePlanningTable();
                }
                
                // Update mixing table if it exists
                if (updateMixingTable) {
                    updateMixingTable('mixingFilters');
                }
                
                // Update closest matches when collection changes
                if (state.currentColor && updateClosestMatches) {
                    updateClosestMatches();
                }
            }
        });
        deleteCell.appendChild(deleteBtn);
        
        row.appendChild(colorCell);
        row.appendChild(nameCell);
        row.appendChild(producerCell);
        row.appendChild(deleteCell);
        tbody.appendChild(row);
    });
    
    // Update collection wheel
    if (drawCollectionPointsOnWheel) {
        drawCollectionPointsOnWheel();
    }
}

// Export collection to JSON file
export function exportCollectionToJSON() {
    const myCollection = getMyCollection();
    const jsonString = JSON.stringify(myCollection, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-collection-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import collection from JSON file
export function importCollectionFromJSON(jsonData) {
    let importedColors = [];
    
    try {
        // Parse JSON if it's a string
        if (typeof jsonData === 'string') {
            importedColors = JSON.parse(jsonData);
        } else {
            importedColors = jsonData;
        }
        
        // Ensure it's an array
        if (!Array.isArray(importedColors)) {
            throw new Error('Invalid format: expected an array of colors');
        }
        
        // Add each color to the collection (addToMyCollection handles duplicates)
        let addedCount = 0;
        let skippedCount = 0;
        
        importedColors.forEach(colorData => {
            // Validate color data structure
            if (colorData && (colorData.hex || (colorData.r !== undefined && colorData.g !== undefined && colorData.b !== undefined))) {
                if (addToMyCollection(colorData)) {
                    addedCount++;
                } else {
                    skippedCount++;
                }
            }
        });
        
        // Reload the collection display
        loadMyCollection();
        
        // Show feedback
        alert(`Import complete!\nAdded: ${addedCount} colors\nSkipped (duplicates): ${skippedCount} colors`);
        
        return { added: addedCount, skipped: skippedCount };
    } catch (error) {
        console.error('Error importing collection:', error);
        alert(`Error importing collection: ${error.message}`);
        return null;
    }
}

// Update effective collection usage (notify dependent modules)
export function notifyEffectiveCollectionChanged() {
    // Update planning table
    if (updatePlanningTable) {
        updatePlanningTable();
    }
    
    // Update mixing table
    if (updateMixingTable) {
        updateMixingTable('mixingFilters');
    }
    
    // Update closest matches
    if (state.currentColor && updateClosestMatches) {
        updateClosestMatches();
    }
    
    // Update collection wheel
    if (drawCollectionPointsOnWheel) {
        drawCollectionPointsOnWheel();
    }
}

// Initialize myCollection module
export function initMyCollection(dependencies = {}) {
    if (dependencies.drawCollectionPointsOnWheel) {
        drawCollectionPointsOnWheel = dependencies.drawCollectionPointsOnWheel;
    }
    if (dependencies.updatePlanningTable) {
        updatePlanningTable = dependencies.updatePlanningTable;
    }
    if (dependencies.updateClosestMatches) {
        updateClosestMatches = dependencies.updateClosestMatches;
    }
    if (dependencies.updateMixingTable) {
        updateMixingTable = dependencies.updateMixingTable;
    }
    if (dependencies.filterData) {
        filterData = dependencies.filterData;
    }
    
    // Set up checkbox
    const useShoppingCheckbox = document.getElementById('useShoppingColorsCheckbox');
    if (useShoppingCheckbox) {
        // Load saved state
        useShoppingCheckbox.checked = loadUseShoppingColors();
        
        // Handle checkbox change
        useShoppingCheckbox.addEventListener('change', (e) => {
            saveUseShoppingColors(e.target.checked);
            notifyEffectiveCollectionChanged();
        });
    }
    
    // Set up save/load buttons
    const saveBtn = document.getElementById('saveCollectionBtn');
    const loadBtn = document.getElementById('loadCollectionBtn');
    const fileInput = document.getElementById('loadCollectionFileInput');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const collection = getMyCollection();
            if (collection.length === 0) {
                alert('Your collection is empty. Add some colors before saving.');
                return;
            }
            exportCollectionToJSON();
        });
    }
    
    if (loadBtn && fileInput) {
        loadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.name.toLowerCase().endsWith('.json')) {
                alert('Please select a JSON file.');
                fileInput.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    importCollectionFromJSON(event.target.result);
                } catch (error) {
                    alert(`Error reading file: ${error.message}`);
                }
                fileInput.value = ''; // Reset file input
            };
            reader.onerror = () => {
                alert('Error reading file. Please try again.');
                fileInput.value = '';
            };
            reader.readAsText(file);
        });
    }
    
    // Load collection on init
    loadMyCollection();
}

