/**
 * Palettes Panel UI component - manages the foldable palette list panel
 */

import { state, getPalettes, setCurrentPaletteId, getCurrentPaletteId, addPalette, removePalette, setPalettes, getPalette } from '../core/state.js';
import { savePalettes, saveCurrentPaletteId } from '../utils/storage.js';

let loadPaletteCallback = null;
let updatePaletteNameCallback = null;
let updatePalettesListCallback = null;
let updatePlanningTableCallback = null;

// Initialize palettes panel
export function initPalettesPanel(dependencies = {}) {
    if (dependencies.loadPalette) {
        loadPaletteCallback = dependencies.loadPalette;
    }
    if (dependencies.updatePaletteName) {
        updatePaletteNameCallback = dependencies.updatePaletteName;
    }
    if (dependencies.updatePalettesList) {
        updatePalettesListCallback = dependencies.updatePalettesList;
    }
    if (dependencies.updatePlanningTable) {
        updatePlanningTableCallback = dependencies.updatePlanningTable;
    }
    
    const panel = document.getElementById('palettesPanel');
    const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
    const panelToggle = document.getElementById('palettesPanelToggle');
    const panelContent = document.getElementById('palettesPanelContent');
    const palettesList = document.getElementById('palettesList');
    const addPaletteBtn = document.getElementById('addPaletteBtn');
    
    // Hamburger menu toggle
    if (hamburgerBtn && panel) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = panel.classList.contains('open');
            
            if (isOpen) {
                panel.classList.remove('open');
                document.body.classList.remove('panel-open');
                hamburgerBtn.classList.remove('active');
            } else {
                panel.classList.add('open');
                document.body.classList.add('panel-open');
                hamburgerBtn.classList.add('active');
            }
        });
        
        // Close panel when mouse leaves the panel (but not when clicking inside)
        let mouseLeaveTimeout = null;
        panel.addEventListener('mouseleave', (e) => {
            // Only close if mouse actually left the panel area
            const relatedTarget = e.relatedTarget;
            if (!panel.contains(relatedTarget) && !hamburgerBtn.contains(relatedTarget)) {
                // Small delay to prevent accidental closes when moving to hamburger button
                mouseLeaveTimeout = setTimeout(() => {
                    if (panel.classList.contains('open')) {
                        const mouseX = e.clientX;
                        const mouseY = e.clientY;
                        const panelRect = panel.getBoundingClientRect();
                        const btnRect = hamburgerBtn.getBoundingClientRect();
                        
                        // Only close if mouse is truly outside both panel and button
                        if (mouseX < panelRect.left && mouseX < btnRect.left) {
                            panel.classList.remove('open');
                            document.body.classList.remove('panel-open');
                            hamburgerBtn.classList.remove('active');
                        }
                    }
                }, 200);
            }
        });
        
        // Cancel close if mouse re-enters panel or button
        panel.addEventListener('mouseenter', () => {
            if (mouseLeaveTimeout) {
                clearTimeout(mouseLeaveTimeout);
                mouseLeaveTimeout = null;
            }
        });
        
        hamburgerBtn.addEventListener('mouseenter', () => {
            if (mouseLeaveTimeout) {
                clearTimeout(mouseLeaveTimeout);
                mouseLeaveTimeout = null;
            }
        });
    }
    
    // Toggle panel content collapse/expand (for the header toggle)
    if (panelToggle && panelContent) {
        panelToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = panelContent.style.display !== 'none';
            panelContent.style.display = isExpanded ? 'none' : 'block';
            const icon = panelToggle.querySelector('.panel-toggle-icon');
            if (icon) {
                icon.textContent = isExpanded ? '▶' : '▼';
            }
            panelToggle.classList.toggle('collapsed', isExpanded);
        });
    }
    
    // Add new palette button
    if (addPaletteBtn) {
        addPaletteBtn.addEventListener('click', () => {
            createNewPalette();
        });
    }
    
    // Load and display palettes
    loadPalettesList();
}

// Load and display the list of palettes
export function loadPalettesList() {
    const palettesList = document.getElementById('palettesList');
    if (!palettesList) return;
    
    palettesList.innerHTML = '';
    
    const palettes = getPalettes();
    const currentId = getCurrentPaletteId();
    
    // Create list items for each palette
    Object.values(palettes).forEach(palette => {
        const paletteItem = document.createElement('div');
        paletteItem.className = 'palette-item-row';
        if (palette.id === currentId) {
            paletteItem.classList.add('active');
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'palette-item-name';
        nameSpan.textContent = palette.name;
        
        const colorCount = document.createElement('span');
        colorCount.className = 'palette-item-count';
        colorCount.textContent = `(${palette.colors.length})`;
        
        const itemContent = document.createElement('div');
        itemContent.className = 'palette-item-content';
        itemContent.appendChild(nameSpan);
        itemContent.appendChild(colorCount);
        
        // Ghost buttons container
        const ghostButtons = document.createElement('div');
        ghostButtons.className = 'palette-item-ghost-buttons';
        
        // Rename button
        const renameBtn = document.createElement('button');
        renameBtn.className = 'palette-ghost-btn palette-rename-btn';
        renameBtn.textContent = 'Rename';
        renameBtn.title = 'Rename palette';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showRenameModal(palette.id, palette.name);
        });
        ghostButtons.appendChild(renameBtn);
        
        // Delete button (only show if more than one palette)
        if (Object.keys(palettes).length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'palette-ghost-btn palette-delete-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.title = 'Delete palette';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${palette.name}"?`)) {
                    deletePalette(palette.id);
                }
            });
            ghostButtons.appendChild(deleteBtn);
        }
        
        paletteItem.appendChild(itemContent);
        paletteItem.appendChild(ghostButtons);
        
        // Click to load palette
        paletteItem.addEventListener('click', (e) => {
            // Don't process if clicking on ghost buttons
            if (e.target.closest('.palette-item-ghost-buttons')) {
                return;
            }
            
            // Don't switch if already the active palette
            if (palette.id === getCurrentPaletteId()) {
                return;
            }
            
            switchToPalette(palette.id);
        });
        
        palettesList.appendChild(paletteItem);
    });
}

// Create a new palette
function createNewPalette() {
    const palettes = getPalettes();
    const newId = 'palette_' + Date.now();
    const paletteNumber = Object.keys(palettes).length + 1;
    
    const newPalette = {
        id: newId,
        name: `Palette ${paletteNumber}`,
        colors: []
    };
    
    addPalette(newId, newPalette);
    savePalettes(state.palettes);
    
    // Switch to new palette
    switchToPalette(newId);
}

// Switch to a different palette
export function switchToPalette(paletteId) {
    // Set the current palette ID first - this updates state.palette
    setCurrentPaletteId(paletteId);
    
    // Save the current palette ID
    saveCurrentPaletteId(paletteId);
    
    // Load and display the palette colors FIRST, before updating UI list
    if (loadPaletteCallback) {
        loadPaletteCallback();
    }
    
    // Update UI list to highlight active palette
    loadPalettesList();
    
    // Update palette name in header
    if (updatePaletteNameCallback) {
        updatePaletteNameCallback();
    }
    
    // Update planning table with new palette data
    if (updatePlanningTableCallback) {
        updatePlanningTableCallback();
    }
}

// Show rename modal
function showRenameModal(paletteId, currentName) {
    const newName = prompt('Enter new palette name:', currentName);
    if (newName !== null && newName.trim() !== '') {
        renamePalette(paletteId, newName.trim());
    }
}

// Rename a palette
function renamePalette(paletteId, newName) {
    if (!newName || newName.trim() === '') return;
    
    const palettes = getPalettes();
    if (palettes[paletteId]) {
        palettes[paletteId].name = newName.trim();
        setPalettes(palettes);
        savePalettes(state.palettes);
        
        // Update UI
        loadPalettesList();
        
        // Update palette name in header if it's the current palette
        if (paletteId === getCurrentPaletteId() && updatePaletteNameCallback) {
            updatePaletteNameCallback();
        }
    }
}

// Delete a palette
function deletePalette(paletteId) {
    const palettes = getPalettes();
    const currentId = getCurrentPaletteId();
    
    // Can't delete if it's the only palette
    if (Object.keys(palettes).length <= 1) {
        alert('Cannot delete the last palette. Create a new palette first.');
        return;
    }
    
    removePalette(paletteId);
    savePalettes(state.palettes);
    
    // If we deleted the current palette, switch to another one
    if (paletteId === currentId) {
        const remainingIds = Object.keys(state.palettes);
        if (remainingIds.length > 0) {
            switchToPalette(remainingIds[0]);
        }
    } else {
        // Just reload the list
        loadPalettesList();
    }
}

