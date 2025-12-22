/**
 * Palettes Panel UI component - manages the foldable palette list panel
 */

import { state, getPalettes, setCurrentPaletteId, getCurrentPaletteId, addPalette, removePalette, setPalettes, getPalette } from '../core/state.js';
import { savePalettes, saveCurrentPaletteId, saveModelImages, loadModelImages, saveModelImageId, loadModelImageId, saveModelsPanelWidth, loadModelsPanelWidth } from '../utils/storage.js';

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
    const addPaletteBtn = document.getElementById('addPaletteBtn');
    const resizeHandle = document.getElementById('modelsPanelResizeHandle');
    
    // Load saved panel width and apply it
    const savedWidth = loadModelsPanelWidth();
    if (panel && savedWidth) {
        panel.style.width = savedWidth + 'px';
        document.documentElement.style.setProperty('--models-panel-width', savedWidth + 'px');
    }
    
    // Initialize resize functionality
    if (resizeHandle && panel) {
        initPanelResize(resizeHandle, panel);
    }
    
    // Hamburger menu toggle
    if (hamburgerBtn && panel) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = panel.classList.contains('open');
            
            if (isOpen) {
                panel.classList.remove('open');
                document.body.classList.remove('panel-open');
                hamburgerBtn.classList.remove('active');
                // Reset hamburger button position to left
                hamburgerBtn.style.left = '';
            } else {
                panel.classList.add('open');
                document.body.classList.add('panel-open');
                const panelWidth = panel.offsetWidth || loadModelsPanelWidth();
                updateBodyPadding(panelWidth);
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
                            // Reset hamburger button position to left
                            hamburgerBtn.style.left = '';
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
    
    // Handle palette panel tabs
    const palettesTabBtns = document.querySelectorAll('.models-tab-btn');
    const currentModelsList = document.getElementById('currentModelsList');
    const allModelsList = document.getElementById('allModelsList');
    
    palettesTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabType = btn.getAttribute('data-models-tab');
            
            // Update active tab
            palettesTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show/hide appropriate content
            if (tabType === 'current') {
                if (currentModelsList) currentModelsList.classList.add('active');
                if (allModelsList) allModelsList.classList.remove('active');
                loadCurrentPaletteList();
            } else {
                if (currentModelsList) currentModelsList.classList.remove('active');
                if (allModelsList) allModelsList.classList.add('active');
                loadPalettesList();
            }
        });
    });
    
    // Initialize uploaded images functionality
    initUploadedImages();
    
    // Load and display palettes (default to current models)
    loadCurrentPaletteList();
}

// Initialize panel resize functionality
function initPanelResize(resizeHandle, panel) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        panel.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const diff = e.clientX - startX;
        let newWidth = startWidth + diff;
        
        // Minimum width constraint to prevent panel from being too small
        const minWidth = 150;
        newWidth = Math.max(minWidth, newWidth);
        
        panel.style.width = newWidth + 'px';
        updateBodyPadding(newWidth);
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            panel.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Save the new width
            const currentWidth = panel.offsetWidth;
            saveModelsPanelWidth(currentWidth);
        }
    });
}

// Update body padding based on panel width (no longer needed - panel overlays)
function updateBodyPadding(panelWidth) {
    // Set CSS variable for hamburger button positioning
    document.documentElement.style.setProperty('--models-panel-width', panelWidth + 'px');
    
    // Update hamburger button position
    const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
    if (hamburgerBtn && document.body.classList.contains('panel-open')) {
        hamburgerBtn.style.left = (panelWidth - 35) + 'px';
    }
}

// Initialize uploaded images functionality
function initUploadedImages() {
    // Load images on initialization
    loadUploadedImages();
    loadModelImage();
}

// Save image from Palette Editor to current model
export function saveImageToCurrentModel(file) {
    if (!file || !file.type.startsWith('image/')) return;
    
    const currentId = getCurrentPaletteId();
    if (!currentId) return;
    
    // Load existing images
    const existingImages = loadModelImages(currentId);
    
    // Convert file to base64 and add to existing images
    const reader = new FileReader();
    reader.onload = (event) => {
        const imageData = {
            id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            dataUrl: event.target.result,
            name: file.name,
            uploadedAt: Date.now()
        };
        
        existingImages.push(imageData);
        saveModelImages(currentId, existingImages);
        
        // Auto-assign as model image if it's the only image
        if (existingImages.length === 1) {
            saveModelImageId(currentId, imageData.id);
        }
        
        loadUploadedImages();
        loadModelImage();
        // Also update References gallery if it's visible
        updateReferencesGalleryIfVisible();
    };
    reader.readAsDataURL(file);
}

// Save image from data URL to current model (for link-based images)
export function saveImageDataUrlToCurrentModel(dataUrl, filename = 'image.jpg') {
    const currentId = getCurrentPaletteId();
    if (!currentId) return;
    
    // Load existing images
    const existingImages = loadModelImages(currentId);
    
    const imageData = {
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        dataUrl: dataUrl,
        name: filename,
        uploadedAt: Date.now()
    };
    
    existingImages.push(imageData);
    saveModelImages(currentId, existingImages);
    
    // Auto-assign as model image if it's the only image
    if (existingImages.length === 1) {
        saveModelImageId(currentId, imageData.id);
    }
    
    loadUploadedImages();
    loadModelImage();
    // Also update References gallery if it's visible
    updateReferencesGalleryIfVisible();
}

// Helper function to update References gallery if visible
function updateReferencesGalleryIfVisible() {
    const referencesTab = document.getElementById('referencesTab');
    if (referencesTab && referencesTab.classList.contains('active')) {
        import('../features/references.js').then(({ loadReferencesGallery }) => {
            loadReferencesGallery();
        }).catch(err => {
            console.error('Error loading references gallery:', err);
        });
    }
}

// Load and display model image
export function loadModelImage() {
    const modelImageDisplay = document.getElementById('modelImageDisplay');
    if (!modelImageDisplay) return;
    
    modelImageDisplay.innerHTML = '';
    
    const currentId = getCurrentPaletteId();
    if (!currentId) {
        const placeholder = document.createElement('div');
        placeholder.className = 'model-image-placeholder';
        placeholder.textContent = 'No Image';
        modelImageDisplay.appendChild(placeholder);
        return;
    }
    
    const images = loadModelImages(currentId);
    const modelImageId = loadModelImageId(currentId);
    
    // Auto-assign if only one image exists
    if (images.length === 1 && !modelImageId) {
        saveModelImageId(currentId, images[0].id);
        const updatedModelImageId = images[0].id;
        displayModelImage(images, updatedModelImageId);
    } else if (modelImageId) {
        displayModelImage(images, modelImageId);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'model-image-placeholder';
        placeholder.textContent = 'No Image';
        modelImageDisplay.appendChild(placeholder);
    }
}

function displayModelImage(images, modelImageId) {
    const modelImageDisplay = document.getElementById('modelImageDisplay');
    if (!modelImageDisplay) return;
    
    const modelImage = images.find(img => img.id === modelImageId);
    
    if (!modelImage) {
        const placeholder = document.createElement('div');
        placeholder.className = 'model-image-placeholder';
        placeholder.textContent = 'No Image';
        modelImageDisplay.appendChild(placeholder);
        return;
    }
    
    modelImageDisplay.innerHTML = '';
    
    const img = document.createElement('img');
    img.src = modelImage.dataUrl;
    img.alt = modelImage.name || 'Model image';
    modelImageDisplay.appendChild(img);
    
    const setBtn = document.createElement('button');
    setBtn.className = 'set-model-image-btn';
    setBtn.type = 'button';
    setBtn.textContent = 'Change';
    setBtn.title = 'Change model image';
    setBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showModelImageSelector();
    });
    modelImageDisplay.appendChild(setBtn);
}

function showModelImageSelector() {
    const currentId = getCurrentPaletteId();
    if (!currentId) return;
    
    const images = loadModelImages(currentId);
    if (images.length === 0) {
        alert('No images available to select');
        return;
    }
    
    // Create a simple selection modal or use the uploaded images grid
    // For simplicity, we'll show a prompt with image names
    const imageList = images.map((img, index) => `${index + 1}. ${img.name || 'Image ' + (index + 1)}`).join('\n');
    const selection = prompt(`Select model image (enter number):\n\n${imageList}`);
    
    if (selection) {
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < images.length) {
            saveModelImageId(currentId, images[index].id);
            loadModelImage();
            loadPalettesList(); // Update model list to show new image
        }
    }
}

// Load and display uploaded images (exported for external use)
export function loadUploadedImages() {
    const uploadedImagesGrid = document.getElementById('uploadedImagesGrid');
    if (!uploadedImagesGrid) return;
    
    uploadedImagesGrid.innerHTML = '';
    
    const currentId = getCurrentPaletteId();
    if (!currentId) return;
    
    const images = loadModelImages(currentId);
    
    if (images.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.gridColumn = '1 / -1';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = '#999';
        emptyMsg.style.padding = '20px';
        emptyMsg.textContent = 'No images uploaded yet';
        uploadedImagesGrid.appendChild(emptyMsg);
        return;
    }
    
    const modelImageId = loadModelImageId(currentId);
    
    images.forEach(image => {
        const imageItem = document.createElement('div');
        imageItem.className = 'uploaded-image-item';
        
        // Highlight if this is the model image
        if (image.id === modelImageId) {
            imageItem.style.borderColor = '#667eea';
            imageItem.style.borderWidth = '3px';
        }
        
        const img = document.createElement('img');
        img.src = image.dataUrl;
        img.alt = image.name || 'Uploaded image';
        
        // Click to load image into Palette Editor or set as model image
        imageItem.addEventListener('click', (e) => {
            // Don't load if clicking on remove button or set model image button
            if (e.target.classList.contains('uploaded-image-remove') || 
                e.target.closest('.uploaded-image-remove') ||
                e.target.classList.contains('set-as-model-image-btn') ||
                e.target.closest('.set-as-model-image-btn')) {
                return;
            }
            
            // Load image into Palette Editor
            import('../features/imagePicker.js').then(({ loadImageFromDataUrl }) => {
                loadImageFromDataUrl(image.dataUrl);
                
                // Switch to Palette Editor tab if not already active
                const paintingTab = document.getElementById('paintingTab');
                const pickerTab = document.getElementById('pickerTab');
                const pickerTabBtn = document.querySelector('.sub-tabs .tab-btn[data-tab="picker"]');
                
                if (paintingTab && !paintingTab.classList.contains('active')) {
                    // Switch to Painting tab
                    const paintingTabBtn = document.querySelector('.main-tabs .tab-btn[data-tab="painting"]');
                    if (paintingTabBtn) {
                        paintingTabBtn.click();
                    }
                }
                
                // Switch to Palette Editor sub-tab
                if (pickerTabBtn && (!pickerTab || !pickerTab.classList.contains('active'))) {
                    pickerTabBtn.click();
                }
            }).catch(err => {
                console.error('Error loading image to canvas:', err);
            });
        });
        
        imageItem.appendChild(img);
        
        // Add "Set as Model Image" button if not already the model image
        if (image.id !== modelImageId) {
            const setModelBtn = document.createElement('button');
            setModelBtn.className = 'set-as-model-image-btn';
            setModelBtn.type = 'button';
            setModelBtn.textContent = 'Set as Model';
            setModelBtn.title = 'Set as model image';
            setModelBtn.style.cssText = 'position: absolute; top: 8px; left: 8px; padding: 4px 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: 500; display: none; z-index: 10;';
            setModelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                saveModelImageId(currentId, image.id);
                loadUploadedImages();
                loadModelImage();
                loadPalettesList();
            });
            imageItem.appendChild(setModelBtn);
            
            imageItem.addEventListener('mouseenter', () => {
                setModelBtn.style.display = 'block';
            });
            imageItem.addEventListener('mouseleave', () => {
                setModelBtn.style.display = 'none';
            });
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'uploaded-image-remove';
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove image';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImage(currentId, image.id);
        });
        imageItem.appendChild(removeBtn);
        
        uploadedImagesGrid.appendChild(imageItem);
    });
}

// Remove an image
function removeImage(paletteId, imageId) {
    const images = loadModelImages(paletteId);
    const modelImageId = loadModelImageId(paletteId);
    
    // If removing the model image, clear it
    if (modelImageId === imageId) {
        saveModelImageId(paletteId, null);
    }
    
    const filteredImages = images.filter(img => img.id !== imageId);
    saveModelImages(paletteId, filteredImages);
    
    // Auto-assign remaining image as model image if only one left
    if (filteredImages.length === 1) {
        saveModelImageId(paletteId, filteredImages[0].id);
    }
    
    loadUploadedImages();
    loadModelImage();
}

// Load and display only the current palette
function loadCurrentPaletteList() {
    const currentPalettesList = document.getElementById('currentPalettesList');
    if (!currentPalettesList) return;
    
    currentPalettesList.innerHTML = '';
    
    const palettes = getPalettes();
    const currentId = getCurrentPaletteId();
    
    // Only show the current palette
    if (currentId && palettes[currentId]) {
        const palette = palettes[currentId];
        const paletteItem = createPaletteItem(palette, currentId);
        currentPalettesList.appendChild(paletteItem);
    }
}

// Helper function to create a palette item
function createPaletteItem(palette, currentId) {
    const paletteItem = document.createElement('div');
    paletteItem.className = 'palette-item-row';
    if (palette.id === currentId) {
        paletteItem.classList.add('active');
    }
    
    // Add model image thumbnail
    const modelImageId = loadModelImageId(palette.id);
    const images = loadModelImages(palette.id);
    const modelImage = modelImageId ? images.find(img => img.id === modelImageId) : null;
    
    const imageThumb = document.createElement('div');
    imageThumb.className = 'palette-item-image';
    
    if (modelImage) {
        const img = document.createElement('img');
        img.src = modelImage.dataUrl;
        img.alt = 'Model image';
        imageThumb.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'palette-item-image-placeholder';
        placeholder.textContent = 'No Image';
        imageThumb.appendChild(placeholder);
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'palette-item-name';
    nameSpan.textContent = palette.name;
    
    const colorCount = document.createElement('span');
    colorCount.className = 'palette-item-count';
    colorCount.textContent = `(${palette.colors.length})`;
    
    const itemContent = document.createElement('div');
    itemContent.className = 'palette-item-content';
    itemContent.appendChild(imageThumb);
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
    const palettes = getPalettes();
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
    
    return paletteItem;
}

// Load and display the list of palettes (all models)
export function loadPalettesList() {
    const modelsList = document.getElementById('modelsList');
    if (!modelsList) return;
    
    modelsList.innerHTML = '';
    
    const palettes = getPalettes();
    const currentId = getCurrentPaletteId();
    
    // Create list items for each palette
    Object.values(palettes).forEach(palette => {
        const paletteItem = createPaletteItem(palette, currentId);
        modelsList.appendChild(paletteItem);
    });
}

// Create a new palette
function createNewPalette() {
    const palettes = getPalettes();
    const newId = 'palette_' + Date.now();
    const paletteNumber = Object.keys(palettes).length + 1;
    
    const newPalette = {
        id: newId,
        name: `Model ${paletteNumber}`,
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
    
    // Update UI lists to highlight active palette
    loadPalettesList();
    loadCurrentPaletteList();
    // Reload uploaded images when switching palettes
    loadUploadedImages();
    loadModelImage();
    
    // Update References gallery if it's open
    const referencesTab = document.getElementById('referencesTab');
    if (referencesTab && referencesTab.classList.contains('active')) {
        import('../features/references.js').then(({ loadReferencesGallery }) => {
            loadReferencesGallery();
        }).catch(err => {
            console.error('Error loading references gallery:', err);
        });
    }
    
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
        loadCurrentPaletteList();
        
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
        // Just reload the lists
        loadPalettesList();
        loadCurrentPaletteList();
    }
}

