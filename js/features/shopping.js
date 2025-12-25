/**
 * Shopping feature - manages shopping cart
 */

import { saveShoppingCart as saveShoppingCartToStorage, loadShoppingCart as loadShoppingCartFromStorage, loadUseShoppingColors } from '../utils/storage.js';
import { addGradientClickToColorBox } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';
import { state, getShoppingCart, setShoppingCart } from '../core/state.js';
import { addToMyCollection } from './myCollection.js';

let filterData = null;
let drawCollectionPointsOnWheel = null;
let notifyEffectiveCollectionChanged = null;
let loadMyCollection = null;

// Save shoppingCart to localStorage
export function saveShoppingCart() {
    saveShoppingCartToStorage(getShoppingCart());
}

// Add color to shoppingCart
export function addToShoppingCart(colorData) {
    const shoppingCart = getShoppingCart();
    
    // Check if color already exists (by hex and name)
    const exists = shoppingCart.some(item => 
        item.hex === colorData.hex && 
        item.name === colorData.name
    );
    
    if (!exists) {
        shoppingCart.push(colorData);
        setShoppingCart(shoppingCart);
        saveShoppingCart();
        loadShoppingCart();
        
        // If "use shopping colors" is checked, update collection wheel and other dependent views
        if (loadUseShoppingColors()) {
            if (drawCollectionPointsOnWheel) {
                drawCollectionPointsOnWheel();
            }
            if (notifyEffectiveCollectionChanged) {
                notifyEffectiveCollectionChanged();
            }
        }
        
        return true;
    }
    return false;
}

// Delete color from shoppingCart
export function deleteColorFromShoppingCart(colorIndex) {
    const shoppingCart = getShoppingCart();
    if (colorIndex >= 0 && colorIndex < shoppingCart.length) {
        shoppingCart.splice(colorIndex, 1);
        setShoppingCart(shoppingCart);
        saveShoppingCart();
        loadShoppingCart();
        
        // If "use shopping colors" is checked, update collection wheel and other dependent views
        if (loadUseShoppingColors()) {
            if (drawCollectionPointsOnWheel) {
                drawCollectionPointsOnWheel();
            }
            if (notifyEffectiveCollectionChanged) {
                notifyEffectiveCollectionChanged();
            }
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

// Load Shopping Cart
export function loadShoppingCart() {
    const shoppingTable = document.getElementById('shoppingTable');
    if (!shoppingTable) return;

    const tbody = shoppingTable.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const shoppingCart = getShoppingCart();

    if (shoppingCart.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'No colors in shopping cart yet. Add colors from Paint Colors tab.';
        row.appendChild(cell);
        tbody.appendChild(row);
        updateHeaderCount('shoppingHeader', 0, 0);
        return;
    }

    // Don't apply filters - shopping tab has no filter container
    const filteredCart = shoppingCart;
    
    // Update header count
    updateHeaderCount('shoppingHeader', filteredCart.length, shoppingCart.length);

    if (filteredCart.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'No colors match the selected filters.';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    filteredCart.forEach((item, filteredIndex) => {
        const row = document.createElement('tr');
        row.className = 'collection-row';
        
        // Find the original index in shoppingCart
        const originalIndex = shoppingCart.findIndex(origItem => 
            origItem.hex === item.hex && 
            origItem.name === item.name &&
            origItem.producer === item.producer
        );
        
        // Color column
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
        
        // Bought button column (move to My Collection)
        const boughtCell = document.createElement('td');
        boughtCell.className = 'action-button-cell';
        const boughtBtn = document.createElement('button');
        boughtBtn.className = 'bought-btn';
        boughtBtn.textContent = 'Bought';
        boughtBtn.title = 'Move to My Collection';
        boughtBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Add to My Collection and remove from Shopping
            if (originalIndex !== -1) {
                const colorToMove = shoppingCart[originalIndex];
                // Add to My Collection first
                if (addToMyCollection && addToMyCollection(colorToMove)) {
                    // Then remove from Shopping
                    deleteColorFromShoppingCart(originalIndex);
                    // Reload My Collection display if callback exists
                    if (loadMyCollection) {
                        loadMyCollection();
                    }
                }
            }
        });
        boughtCell.appendChild(boughtBtn);
        
        // Delete button column
        const deleteCell = document.createElement('td');
        deleteCell.className = 'delete-button-cell';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-from-collection-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove from Shopping Cart';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Remove item from shopping cart using original index
            if (originalIndex !== -1) {
                deleteColorFromShoppingCart(originalIndex);
            }
        });
        deleteCell.appendChild(deleteBtn);
        
        row.appendChild(colorCell);
        row.appendChild(nameCell);
        row.appendChild(producerCell);
        row.appendChild(boughtCell);
        row.appendChild(deleteCell);
        tbody.appendChild(row);
    });
}

// Export shopping cart to JSON file
export function exportShoppingCartToJSON() {
    const shoppingCart = getShoppingCart();
    const jsonString = JSON.stringify(shoppingCart, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping-cart-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import shopping cart from JSON file
export function importShoppingCartFromJSON(jsonData) {
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
        
        // Add each color to the shopping cart (addToShoppingCart handles duplicates)
        let addedCount = 0;
        let skippedCount = 0;
        
        importedColors.forEach(colorData => {
            // Validate color data structure
            if (colorData && (colorData.hex || (colorData.r !== undefined && colorData.g !== undefined && colorData.b !== undefined))) {
                if (addToShoppingCart(colorData)) {
                    addedCount++;
                } else {
                    skippedCount++;
                }
            }
        });
        
        // Reload the shopping cart display
        loadShoppingCart();
        
        // Show feedback
        alert(`Import complete!\nAdded: ${addedCount} colors\nSkipped (duplicates): ${skippedCount} colors`);
        
        return { added: addedCount, skipped: skippedCount };
    } catch (error) {
        console.error('Error importing shopping cart:', error);
        alert(`Error importing shopping cart: ${error.message}`);
        return null;
    }
}

// Initialize shopping module
export function initShopping(dependencies = {}) {
    if (dependencies.filterData) {
        filterData = dependencies.filterData;
    }
    if (dependencies.drawCollectionPointsOnWheel) {
        drawCollectionPointsOnWheel = dependencies.drawCollectionPointsOnWheel;
    }
    if (dependencies.notifyEffectiveCollectionChanged) {
        notifyEffectiveCollectionChanged = dependencies.notifyEffectiveCollectionChanged;
    }
    if (dependencies.loadMyCollection) {
        loadMyCollection = dependencies.loadMyCollection;
    }
    
    // Set up save/load buttons
    const saveBtn = document.getElementById('saveShoppingBtn');
    const loadBtn = document.getElementById('loadShoppingBtn');
    const fileInput = document.getElementById('loadShoppingFileInput');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const cart = getShoppingCart();
            if (cart.length === 0) {
                alert('Your shopping cart is empty. Add some colors before saving.');
                return;
            }
            exportShoppingCartToJSON();
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
                    importShoppingCartFromJSON(event.target.result);
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
    
    // Load shopping cart on init
    loadShoppingCart();
}

