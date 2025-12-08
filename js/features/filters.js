/**
 * Filters feature - manages filter checkboxes and data filtering
 */

import { getUniqueProducersAndTypes } from './paintColors.js';

// Callbacks for dependencies
let loadPaintColors = null;
let loadMyCollection = null;
let updatePlanningTable = null;
let updateClosestMatches = null;
let drawCollectionPointsOnWheel = null;
let getCurrentColor = null;

// Create filter checkboxes
export function createFilterCheckboxes(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const { producers, types } = getUniqueProducersAndTypes();
    
    container.innerHTML = '';
    
    // Producer filter group
    const producerGroup = document.createElement('div');
    producerGroup.className = 'filter-group';
    const producerTitle = document.createElement('div');
    producerTitle.className = 'filter-group-title';
    
    const producerLabel = document.createElement('span');
    producerLabel.textContent = 'Producer:';
    producerTitle.appendChild(producerLabel);
    
    // Add "none" and "all" buttons
    const producerActions = document.createElement('div');
    producerActions.className = 'filter-group-actions';
    
    const producerNoneBtn = document.createElement('button');
    producerNoneBtn.className = 'filter-action-btn';
    producerNoneBtn.textContent = 'none';
    producerNoneBtn.type = 'button';
    producerNoneBtn.addEventListener('click', () => {
        const producerCheckboxes = producerGroup.querySelectorAll('input[data-filter-type="producer"]');
        producerCheckboxes.forEach(cb => cb.checked = false);
        triggerReload(containerId);
    });
    
    const producerAllBtn = document.createElement('button');
    producerAllBtn.className = 'filter-action-btn';
    producerAllBtn.textContent = 'all';
    producerAllBtn.type = 'button';
    producerAllBtn.addEventListener('click', () => {
        const producerCheckboxes = producerGroup.querySelectorAll('input[data-filter-type="producer"]');
        producerCheckboxes.forEach(cb => cb.checked = true);
        triggerReload(containerId);
    });
    
    producerActions.appendChild(producerNoneBtn);
    producerActions.appendChild(producerAllBtn);
    producerTitle.appendChild(producerActions);
    producerGroup.appendChild(producerTitle);
    
    const producerCheckboxes = document.createElement('div');
    producerCheckboxes.className = 'filter-checkboxes';
    
    producers.forEach(producer => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'filter-checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${containerId}-producer-${producer}`;
        checkbox.value = producer;
        checkbox.checked = true; // All checked by default
        checkbox.dataset.filterType = 'producer';
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = producer;
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        producerCheckboxes.appendChild(checkboxItem);
    });
    
    producerGroup.appendChild(producerCheckboxes);
    container.appendChild(producerGroup);
    
    // Type filter group
    const typeGroup = document.createElement('div');
    typeGroup.className = 'filter-group';
    const typeTitle = document.createElement('div');
    typeTitle.className = 'filter-group-title';
    
    const typeLabel = document.createElement('span');
    typeLabel.textContent = 'Type:';
    typeTitle.appendChild(typeLabel);
    
    // Add "none" and "all" buttons
    const typeActions = document.createElement('div');
    typeActions.className = 'filter-group-actions';
    
    const typeNoneBtn = document.createElement('button');
    typeNoneBtn.className = 'filter-action-btn';
    typeNoneBtn.textContent = 'none';
    typeNoneBtn.type = 'button';
    typeNoneBtn.addEventListener('click', () => {
        const typeCheckboxes = typeGroup.querySelectorAll('input[data-filter-type="type"]');
        typeCheckboxes.forEach(cb => cb.checked = false);
        triggerReload(containerId);
    });
    
    const typeAllBtn = document.createElement('button');
    typeAllBtn.className = 'filter-action-btn';
    typeAllBtn.textContent = 'all';
    typeAllBtn.type = 'button';
    typeAllBtn.addEventListener('click', () => {
        const typeCheckboxes = typeGroup.querySelectorAll('input[data-filter-type="type"]');
        typeCheckboxes.forEach(cb => cb.checked = true);
        triggerReload(containerId);
    });
    
    typeActions.appendChild(typeNoneBtn);
    typeActions.appendChild(typeAllBtn);
    typeTitle.appendChild(typeActions);
    typeGroup.appendChild(typeTitle);
    
    const typeCheckboxes = document.createElement('div');
    typeCheckboxes.className = 'filter-checkboxes';
    
    types.forEach(type => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'filter-checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${containerId}-type-${type}`;
        checkbox.value = type;
        checkbox.checked = true; // All checked by default
        checkbox.dataset.filterType = 'type';
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = type;
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        typeCheckboxes.appendChild(checkboxItem);
    });
    
    typeGroup.appendChild(typeCheckboxes);
    container.appendChild(typeGroup);
    
    // Add event listeners to all checkboxes
    const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            triggerReload(containerId);
        });
    });
}

// Trigger reload based on container ID
function triggerReload(containerId) {
    if (containerId === 'paintColorsFilters') {
        if (loadPaintColors) loadPaintColors();
    } else if (containerId === 'myCollectionFilters') {
        if (loadMyCollection) loadMyCollection();
        // Update collection wheel when filters change
        if (drawCollectionPointsOnWheel) {
            drawCollectionPointsOnWheel();
        }
    } else if (containerId === 'planningFilters') {
        if (updatePlanningTable) {
            updatePlanningTable();
        }
    } else if (containerId === 'selectedColorFilters') {
        // Update closest matches when filters change
        const currentColor = getCurrentColor ? getCurrentColor() : null;
        if (currentColor && updateClosestMatches) {
            updateClosestMatches();
        }
    }
}

// Get selected filter values
export function getSelectedFilters(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return { producers: [], types: [] };
    }
    
    const producerCheckboxes = container.querySelectorAll('input[data-filter-type="producer"]:checked');
    const typeCheckboxes = container.querySelectorAll('input[data-filter-type="type"]:checked');
    
    const selectedProducers = Array.from(producerCheckboxes).map(cb => cb.value);
    const selectedTypes = Array.from(typeCheckboxes).map(cb => cb.value);
    
    return {
        producers: selectedProducers,
        types: selectedTypes
    };
}

// Filter data based on selected filters
export function filterData(data, containerId) {
    if (!data || data.length === 0) return [];
    
    const filters = getSelectedFilters(containerId);
    
    // If no filters selected, return empty array
    if (filters.producers.length === 0 && filters.types.length === 0) {
        return [];
    }
    
    return data.filter(item => {
        // Producer filter
        let producerMatch = true;
        if (filters.producers.length > 0) {
            producerMatch = filters.producers.includes(item.producer);
        }
        
        // Type filter
        let typeMatch = true;
        if (filters.types.length > 0) {
            if (!item.type || (Array.isArray(item.type) && item.type.length === 0)) {
                typeMatch = false;
            } else {
                typeMatch = item.type.some(type => filters.types.includes(type));
            }
        }
        
        return producerMatch && typeMatch;
    });
}

// Initialize filters module
export function initFilters(dependencies = {}) {
    if (dependencies.loadPaintColors) {
        loadPaintColors = dependencies.loadPaintColors;
    }
    if (dependencies.loadMyCollection) {
        loadMyCollection = dependencies.loadMyCollection;
    }
    if (dependencies.updatePlanningTable) {
        updatePlanningTable = dependencies.updatePlanningTable;
    }
    if (dependencies.updateClosestMatches) {
        updateClosestMatches = dependencies.updateClosestMatches;
    }
    if (dependencies.drawCollectionPointsOnWheel) {
        drawCollectionPointsOnWheel = dependencies.drawCollectionPointsOnWheel;
    }
    if (dependencies.getCurrentColor) {
        getCurrentColor = dependencies.getCurrentColor;
    }
}

