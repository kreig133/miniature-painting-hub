/**
 * My Collection feature - manages user's color collection
 */

import { saveMyCollection as saveMyCollectionToStorage, loadMyCollection as loadMyCollectionFromStorage } from '../utils/storage.js';
import { addGradientClickToColorBox } from '../utils/colorUtils.js';
import { state, getMyCollection, setMyCollection } from '../core/state.js';

let drawCollectionPointsOnWheel = null;
let updatePlanningTable = null;
let updateClosestMatches = null;
let filterData = null;

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
    if (dependencies.filterData) {
        filterData = dependencies.filterData;
    }
    
    // Load collection on init
    loadMyCollection();
}

