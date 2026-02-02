/**
 * Minipaint feature - Canvas-based image editor
 */

import { getCurrentModel, getPalleteWithMappings } from '../core/state.js';
import { getImages, saveImage } from '../utils/imageStorage.js';
import { getPalette, addColorToPalette } from './palette.js';
import { hexToRgb, rgbToHSV, rgbToHex } from '../utils/colorUtils.js';

let currentTool = 'brush';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let prevX = 0;
let prevY = 0;
let startX = 0;
let startY = 0;
let currentImage = null;
let canvas = null;
let ctx = null;
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 50;
let originalImageWidth = 0;
let originalImageHeight = 0;

// Selection tool state
let selectionVertices = [];
let isSelectionActive = false;
let isSelectionInverted = false; // Track if selection is inverted (outside instead of inside)
let lastSelectionClickTime = 0;
const DOUBLE_CLICK_DELAY = 300; // milliseconds

// Load and display minipaint gallery
export async function loadMinipaintGallery() {
    const gallery = document.getElementById('minipaintGallery');
    if (!gallery) return;
    
    gallery.innerHTML = '';
    
    const model = getCurrentModel();
    if (!model) {
        gallery.innerHTML = '<div class="references-gallery-empty">No model selected</div>';
        return;
    }
    
    const imageIds = model.references || [];
    
    if (imageIds.length === 0) {
        gallery.innerHTML = '<div class="references-gallery-empty">No images uploaded yet. Upload images using "Choose Image" in Palette Editor.</div>';
        return;
    }
    
    // Load images from IndexedDB
    const images = await getImages(imageIds);
    
    if (images.length === 0) {
        gallery.innerHTML = '<div class="references-gallery-empty">No images uploaded yet. Upload images using "Choose Image" in Palette Editor.</div>';
        return;
    }
    
    images.forEach((image) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'references-gallery-item';
        
        const img = document.createElement('img');
        img.src = image.dataUrl;
        img.alt = image.name || 'Reference image';
        
        // Click to open editor
        galleryItem.addEventListener('click', () => {
            openMinipaintEditor(image);
        });
        
        galleryItem.appendChild(img);
        gallery.appendChild(galleryItem);
    });
}

// Open minipaint editor modal
function openMinipaintEditor(image) {
    currentImage = image;
    
    // Reset selection state
    clearSelection();
    // Ensure Fill and Color Balance buttons are hidden initially
    updateFillButtonVisibility();
    // Update brush size group visibility
    updateBrushSizeGroupVisibility();
    // Update smoothing group visibility
    updateSmoothingGroupVisibility();
    
    const modal = document.getElementById('minipaintModal');
    if (!modal) return;
    
    canvas = document.getElementById('minipaintCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Grey out other wheels
    if (window.greyOutOtherWheels) {
        window.greyOutOtherWheels();
    }
    
    // Show modal first so container dimensions are available
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load image onto canvas
    const img = new Image();
    img.onload = () => {
        // Store original image dimensions
        originalImageWidth = img.width;
        originalImageHeight = img.height;
        
        // Set canvas internal resolution to image size (for quality)
        canvas.width = originalImageWidth;
        canvas.height = originalImageHeight;
        
        // Draw image at full resolution
        ctx.drawImage(img, 0, 0);
        
        // Calculate display size to fit container - use requestAnimationFrame to ensure modal is rendered
        requestAnimationFrame(() => {
            fitCanvasToContainer();
        });
        
        // Initialize history with the initial image state
        saveState();
    };
    img.src = image.dataUrl;
    
    // Load palette colors based on toggle state
    const colorSourceToggle = document.getElementById('minipaintColorSourceToggle');
    const useAssignedPaints = colorSourceToggle ? colorSourceToggle.checked : false;
    loadPaletteColors(useAssignedPaints);
}

// Fit canvas to container while maintaining aspect ratio
function fitCanvasToContainer() {
    if (!canvas || originalImageWidth === 0 || originalImageHeight === 0) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    // Get available space (accounting for padding)
    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width - 40; // Account for padding
    const maxHeight = containerRect.height - 40;
    
    // Calculate scale to fit while maintaining aspect ratio
    const scaleX = maxWidth / originalImageWidth;
    const scaleY = maxHeight / originalImageHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't upscale, only downscale
    
    // Set canvas display size via CSS
    const displayWidth = originalImageWidth * scale;
    const displayHeight = originalImageHeight * scale;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
}

// Close minipaint editor modal
function closeMinipaintEditor() {
    const modal = document.getElementById('minipaintModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    if (window.ungreyOtherWheels) {
        window.ungreyOtherWheels();
    }
    
    // Reset state
    isDrawing = false;
    currentImage = null;
    historyStack = [];
    historyIndex = -1;
    originalImageWidth = 0;
    originalImageHeight = 0;
    clearSelection();
}

// Save current canvas state to history
function saveState() {
    if (!canvas || !ctx) return;
    
    // Reset composite operation to source-over before saving
    // This ensures the saved state is correct regardless of current tool
    const previousCompositeOperation = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'source-over';
    
    // Remove any states after current index (for redo functionality, if needed)
    historyStack = historyStack.slice(0, historyIndex + 1);
    
    // Save current state
    // Note: This should be called BEFORE redrawCanvasWithSelection to avoid saving overlays
    const state = canvas.toDataURL('image/png');
    historyStack.push(state);
    historyIndex++;
    
    // Restore previous composite operation
    ctx.globalCompositeOperation = previousCompositeOperation;
    
    // Limit history size
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
        historyIndex--;
    }
    
    updateUndoButton();
    
    // Update debug gallery if debug mode is enabled
    updateDebugGallery();
}

// Save state before starting a new drawing action
let stateSavedForCurrentAction = false;
function saveStateBeforeAction() {
    if (!stateSavedForCurrentAction) {
        saveState();
        stateSavedForCurrentAction = true;
    }
}

// Restore state from history
function restoreState() {
    if (historyIndex < 0 || historyIndex >= historyStack.length) return;
    if (!canvas || !ctx) return;
    
    const img = new Image();
    img.onload = () => {
        // Reset composite operation to source-over before restoring
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Redraw selection if active
        if (isSelectionActive && selectionVertices.length > 0) {
            redrawCanvasWithSelection();
        }
        
        // Update debug gallery if debug mode is enabled
        updateDebugGallery();
    };
    img.onerror = () => {
        console.error('Error loading image from history');
    };
    img.src = historyStack[historyIndex];
}

// Undo last action
function undo() {
    if (historyIndex <= 0) return; // Can't undo beyond initial state
    
    historyIndex--;
    restoreState();
    updateUndoButton();
}

// Update undo button state
function updateUndoButton() {
    const undoBtn = document.getElementById('minipaintUndoBtn');
    if (undoBtn) {
        if (historyIndex <= 0) {
            undoBtn.disabled = true;
            undoBtn.style.opacity = '0.5';
            undoBtn.style.cursor = 'not-allowed';
        } else {
            undoBtn.disabled = false;
            undoBtn.style.opacity = '1';
            undoBtn.style.cursor = 'pointer';
        }
    }
}

// Helper function to check if mapping is a paint object (not a mixing scheme)
function isPaintObject(mapping) {
    if (!mapping) return false;
    // Mixing scheme has colors array, paint object doesn't
    return typeof mapping === 'object' && mapping.hex && !Array.isArray(mapping.colors);
}

// Helper function to check if mapping is a mixing scheme
function isMixingScheme(mapping) {
    return mapping && typeof mapping === 'object' && Array.isArray(mapping.colors) && Array.isArray(mapping.coefficients);
}

// Get assigned paints from planning mappings
function getAssignedPaints() {
    const mappings = getPalleteWithMappings();
    const assignedPaints = [];
    const seenColors = new Set(); // Track seen colors by hex to avoid duplicates
    
    Object.values(mappings).forEach(mappingData => {
        if (!mappingData || !mappingData.mapping) return;
        
        const mapping = mappingData.mapping;
        
        // If it's a paint object (not a mixing scheme)
        if (isPaintObject(mapping)) {
            const colorHex = mapping.hex;
            if (!seenColors.has(colorHex)) {
                seenColors.add(colorHex);
                assignedPaints.push({
                    hex: mapping.hex,
                    name: mapping.name || '',
                    producer: mapping.producer || '',
                    type: mapping.type || []
                });
            }
        } else if (isMixingScheme(mapping) && mapping.resultHex) {
            // If it's a mixing scheme, add the result color
            const resultHex = mapping.resultHex;
            if (!seenColors.has(resultHex)) {
                seenColors.add(resultHex);
                assignedPaints.push({
                    hex: resultHex,
                    name: 'Mixed Color',
                    producer: '',
                    type: []
                });
            }
        }
    });
    
    return assignedPaints;
}

// Load and display palette colors or assigned paints
function loadPaletteColors(useAssignedPaints = false) {
    const paletteColorsContainer = document.getElementById('minipaintPaletteColors');
    if (!paletteColorsContainer) return;
    
    paletteColorsContainer.innerHTML = '';
    
    let colors = [];
    if (useAssignedPaints) {
        colors = getAssignedPaints();
    } else {
        colors = getPalette();
    }
    
    if (colors.length === 0) {
        return; // Don't show anything if empty
    }
    
    colors.forEach((color) => {
        const colorBox = document.createElement('div');
        colorBox.className = 'minipaint-palette-color-box';
        colorBox.style.backgroundColor = color.hex;
        colorBox.title = color.hex.toUpperCase();
        colorBox.setAttribute('data-color', color.hex);
        
        colorBox.addEventListener('click', () => {
            const colorPicker = document.getElementById('minipaintColorPicker');
            if (colorPicker) {
                colorPicker.value = color.hex;
                // Trigger change event to update any listeners
                colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        
        paletteColorsContainer.appendChild(colorBox);
    });
}

// Initialize minipaint feature
export function initMinipaint() {
    const modal = document.getElementById('minipaintModal');
    const closeBtn = document.getElementById('minipaintModalClose');
    const saveBtn = document.getElementById('minipaintSaveBtn');
    const undoBtn = document.getElementById('minipaintUndoBtn');
    const toolButtons = document.querySelectorAll('.minipaint-tool-btn');
    const colorPicker = document.getElementById('minipaintColorPicker');
    const brushSizeSlider = document.getElementById('minipaintBrushSize');
    const brushSizeValue = document.getElementById('minipaintBrushSizeValue');
    const invertBtn = document.getElementById('minipaintInvertBtn');
    
    canvas = document.getElementById('minipaintCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
    }
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMinipaintEditor);
    }
    
    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeMinipaintEditor();
            }
        });
    }
    
    // Tool buttons
    if (toolButtons) {
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const newTool = btn.getAttribute('data-tool');
                
                // Clear selection when switching tools (except when switching to selection, fill, or colorbalance tool)
                // Also skip if newTool is null/undefined (buttons without data-tool attribute like Color Balance)
                if (currentTool === 'selection' && newTool && newTool !== 'selection' && newTool !== 'fill' && newTool !== 'colorbalance') {
                    clearSelection();
                }
                
                currentTool = newTool;
                
                // Update cursor based on tool
                if (canvas) {
                    if (currentTool === 'colorpicker') {
                        canvas.style.cursor = 'crosshair';
                    } else if (currentTool === 'selection') {
                        canvas.style.cursor = 'crosshair';
                    } else if (currentTool === 'fill') {
                        canvas.style.cursor = 'pointer';
                    } else {
                        canvas.style.cursor = 'crosshair';
                    }
                }
                
                // Update Fill button visibility when tool changes (to show/hide dropdown)
                updateFillButtonVisibility();
                // Update Brush size group visibility when tool changes
                updateBrushSizeGroupVisibility();
                // Update Smoothing group visibility when tool changes
                updateSmoothingGroupVisibility();
            });
        });
    }
    
    // Brush size slider
    if (brushSizeSlider && brushSizeValue) {
        brushSizeSlider.addEventListener('input', (e) => {
            brushSizeValue.textContent = e.target.value;
        });
    }
    
    // Smoothing slider
    const smoothingSlider = document.getElementById('minipaintSmoothing');
    const smoothingValue = document.getElementById('minipaintSmoothingValue');
    if (smoothingSlider && smoothingValue) {
        smoothingSlider.addEventListener('input', (e) => {
            smoothingValue.textContent = e.target.value;
        });
    }
    
    // Add to Palette button
    const addToPaletteBtn = document.getElementById('minipaintAddToPaletteBtn');
    if (addToPaletteBtn && addColorToPalette) {
        addToPaletteBtn.addEventListener('click', () => {
            const colorPicker = document.getElementById('minipaintColorPicker');
            if (!colorPicker) return;
            
            const hexColor = colorPicker.value;
            
            // Check if color already exists in palette
            const currentPalette = getPalette();
            const colorExists = currentPalette.some(color => color.hex.toLowerCase() === hexColor.toLowerCase());
            
            if (colorExists) {
                alert('This color is already in your palette!');
                return;
            }
            
            const rgb = hexToRgb(hexColor);
            if (!rgb) return;
            
            const hsv = rgbToHSV(rgb.r, rgb.g, rgb.b);
            const colorObject = {
                hex: hexColor,
                r: rgb.r,
                g: rgb.g,
                b: rgb.b,
                h: hsv.h,
                s: hsv.s,
                v: hsv.v
            };
            
            // Add color to palette
            addColorToPalette(colorObject);
            
            // Reload palette colors if showing palette
            const colorSourceToggle = document.getElementById('minipaintColorSourceToggle');
            const useAssignedPaints = colorSourceToggle && colorSourceToggle.checked;
            if (!useAssignedPaints) {
                loadPaletteColors(false);
            }
        });
    }
    
    // Color source toggle (Palette / Assigned Paints)
    const colorSourceToggle = document.getElementById('minipaintColorSourceToggle');
    if (colorSourceToggle) {
        // Load initial state based on toggle
        const initialUseAssignedPaints = colorSourceToggle.checked;
        loadPaletteColors(initialUseAssignedPaints);
        
        colorSourceToggle.addEventListener('change', (e) => {
            const useAssignedPaints = e.target.checked; // When checked (right/Assigned), use assigned paints
            loadPaletteColors(useAssignedPaints);
        });
    }
    
    // Invert button
    if (invertBtn) {
        invertBtn.addEventListener('click', () => {
            if (isSelectionActive && selectionVertices.length > 0) {
                invertSelection();
            }
        });
    }
    
    // Color Balance button
    const colorBalanceBtn = document.getElementById('minipaintToolColorBalance');
    if (colorBalanceBtn) {
        colorBalanceBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tool button handler from running
            if (selectionVertices.length > 0) {
                openColorBalanceModal();
            }
        });
    }
    
    // Debug mode toggle
    const debugModeCheckbox = document.getElementById('minipaintDebugMode');
    const debugGallery = document.getElementById('minipaintDebugGallery');
    if (debugModeCheckbox && debugGallery) {
        debugModeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                debugGallery.style.display = 'flex';
                updateDebugGallery();
            } else {
                debugGallery.style.display = 'none';
            }
        });
    }
    
    // Undo button
    if (undoBtn) {
        undoBtn.addEventListener('click', undo);
        updateUndoButton();
    }
    
    // Keyboard shortcuts (Ctrl+Z / Cmd+Z for undo, Esc for clearing selection)
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('minipaintModal');
        if (!modal || !modal.classList.contains('active')) return;
        
        // Check if we're in an input field (don't override browser undo in inputs)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Esc key - clear selection (finished or unfinished)
        if (e.key === 'Escape') {
            if (selectionVertices.length > 0) {
                clearSelection();
                e.preventDefault();
            }
        }
        
        // Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
    });
    
    // Handle window resize to refit canvas
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
        const modal = document.getElementById('minipaintModal');
        if (!modal || !modal.classList.contains('active')) return;
        
        // Debounce resize events
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
            fitCanvasToContainer();
        }, 100);
    });
    
    // Canvas drawing and color picker
    if (canvas && ctx) {
        // Initialize magnifying glass for color picker
        const magnifyingGlass = document.getElementById('minipaintMagnifyingGlass');
        const magnifyingGlassCanvas = document.getElementById('minipaintMagnifyingGlassCanvas');
        const canvasContainer = canvas.parentElement;
        
        if (magnifyingGlassCanvas) {
            magnifyingGlassCanvas.width = 120;
            magnifyingGlassCanvas.height = 120;
        }
        
        let magnifyingGlassAnimationFrame = null;
        
        // Mouse move handler for color picker magnifying glass and drawing
        canvas.addEventListener('mousemove', (e) => {
            if (currentTool === 'colorpicker') {
                // Show magnifying glass
                if (magnifyingGlass && magnifyingGlassCanvas && canvasContainer) {
                    const rect = canvas.getBoundingClientRect();
                    const containerRect = canvasContainer.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const x = Math.floor((e.clientX - rect.left) * scaleX);
                    const y = Math.floor((e.clientY - rect.top) * scaleY);
                    
                    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                        const glassSize = 120;
                        const glassX = e.clientX - containerRect.left - glassSize / 2;
                        const glassY = e.clientY - containerRect.top - glassSize / 2;
                        
                        magnifyingGlass.style.display = 'block';
                        magnifyingGlass.style.left = glassX + 'px';
                        magnifyingGlass.style.top = glassY + 'px';
                        
                        // Update magnified view
                        if (magnifyingGlassAnimationFrame) {
                            cancelAnimationFrame(magnifyingGlassAnimationFrame);
                        }
                        
                        magnifyingGlassAnimationFrame = requestAnimationFrame(() => {
                            const zoom = 2;
                            const sourceSize = glassSize / zoom;
                            const sourceX = x - sourceSize / 2;
                            const sourceY = y - sourceSize / 2;
                            
                            const magCtx = magnifyingGlassCanvas.getContext('2d');
                            magCtx.clearRect(0, 0, glassSize, glassSize);
                            magCtx.save();
                            magCtx.beginPath();
                            magCtx.arc(glassSize / 2, glassSize / 2, glassSize / 2, 0, 2 * Math.PI);
                            magCtx.clip();
                            
                            magCtx.drawImage(
                                canvas,
                                sourceX, sourceY, sourceSize, sourceSize,
                                0, 0, glassSize, glassSize
                            );
                            
                            // Draw crosshair in center
                            magCtx.restore();
                            magCtx.strokeStyle = '#fff';
                            magCtx.lineWidth = 2;
                            magCtx.beginPath();
                            magCtx.moveTo(glassSize / 2 - 10, glassSize / 2);
                            magCtx.lineTo(glassSize / 2 + 10, glassSize / 2);
                            magCtx.moveTo(glassSize / 2, glassSize / 2 - 10);
                            magCtx.lineTo(glassSize / 2, glassSize / 2 + 10);
                            magCtx.stroke();
                            magCtx.strokeStyle = '#000';
                            magCtx.lineWidth = 1;
                            magCtx.beginPath();
                            magCtx.moveTo(glassSize / 2 - 10, glassSize / 2);
                            magCtx.lineTo(glassSize / 2 + 10, glassSize / 2);
                            magCtx.moveTo(glassSize / 2, glassSize / 2 - 10);
                            magCtx.lineTo(glassSize / 2, glassSize / 2 + 10);
                            magCtx.stroke();
                        });
                    } else {
                        if (magnifyingGlass) {
                            magnifyingGlass.style.display = 'none';
                        }
                    }
                }
            } else if (currentTool === 'selection') {
                // Preview selection while drawing (only if selection is not finished)
                if (selectionVertices.length > 0 && !isSelectionActive) {
                    drawSelectionPreview(e);
                } else if (isSelectionActive && selectionVertices.length > 2) {
                    // Selection is finished - just redraw without preview line
                    redrawCanvasWithSelection();
                }
            } else {
                // Hide magnifying glass when not using color picker
                if (magnifyingGlass) {
                    magnifyingGlass.style.display = 'none';
                }
                if (magnifyingGlassAnimationFrame) {
                    cancelAnimationFrame(magnifyingGlassAnimationFrame);
                }
                // Continue with normal drawing
                draw(e);
            }
        });
        
        canvas.addEventListener('mouseleave', () => {
            if (magnifyingGlass) {
                magnifyingGlass.style.display = 'none';
            }
            if (magnifyingGlassAnimationFrame) {
                cancelAnimationFrame(magnifyingGlassAnimationFrame);
            }
        });
        
        // Mouse down handler
        canvas.addEventListener('mousedown', (e) => {
            if (currentTool === 'colorpicker') {
                // Pick color from canvas
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = Math.floor((e.clientX - rect.left) * scaleX);
                const y = Math.floor((e.clientY - rect.top) * scaleY);
                
                if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                    const pixel = ctx.getImageData(x, y, 1, 1).data;
                    const r = pixel[0];
                    const g = pixel[1];
                    const b = pixel[2];
                    const hex = rgbToHex(r, g, b);
                    
                    // Set the color in the color picker
                    const colorPicker = document.getElementById('minipaintColorPicker');
                    if (colorPicker) {
                        colorPicker.value = hex;
                        colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            } else if (currentTool === 'selection') {
                handleSelectionClick(e);
            } else if (currentTool === 'fill') {
                handleFillClick(e);
            } else {
                startDrawing(e);
            }
        });
        
        // Double click handler for selection
        canvas.addEventListener('dblclick', (e) => {
            if (currentTool === 'selection' && selectionVertices.length > 0) {
                e.preventDefault();
                // If a vertex was just added, remove it (double-click was quick)
                const now = Date.now();
                if (now - lastSelectionClickTime < DOUBLE_CLICK_DELAY && selectionVertices.length > 0) {
                    selectionVertices.pop(); // Remove the vertex added by the second click
                }
                finishSelection();
            }
        });
        
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', (e) => {
            stopDrawing(e);
            if (magnifyingGlass) {
                magnifyingGlass.style.display = 'none';
            }
        });
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', handleTouch);
        canvas.addEventListener('touchmove', handleTouch);
        canvas.addEventListener('touchend', stopDrawing);
    }
    
    // Save button
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!canvas || !currentImage) return;
            
            try {
                const dataUrl = canvas.toDataURL('image/png');
                const updatedImage = {
                    ...currentImage,
                    dataUrl: dataUrl
                };
                await saveImage(updatedImage);
                
                // Reload gallery
                await loadMinipaintGallery();
                
                // Close modal
                closeMinipaintEditor();
            } catch (error) {
                console.error('Error saving image:', error);
                alert('Error saving image. Please try again.');
            }
        });
    }
}

function startDrawing(e) {
    // Save state before starting to draw (only once per action)
    stateSavedForCurrentAction = false;
    saveStateBeforeAction();
    
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    lastX = x;
    lastY = y;
    prevX = x;
    prevY = y;
    startX = x;
    startY = y;
}

function draw(e) {
    if (!isDrawing || !ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;
    
    const colorPicker = document.getElementById('minipaintColorPicker');
    const brushSizeSlider = document.getElementById('minipaintBrushSize');
    const smoothingSlider = document.getElementById('minipaintSmoothing');
    const color = colorPicker ? colorPicker.value : '#000000';
    const size = brushSizeSlider ? parseInt(brushSizeSlider.value) : 5;
    const smoothing = smoothingSlider ? parseInt(smoothingSlider.value) : 50;
    
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.beginPath();
        
        if (smoothing > 0) {
            // Enhanced smoothing using quadratic curves with very aggressive smoothing
            // Use linear scaling for maximum smoothing effect
            const smoothingFactor = smoothing / 100;
            const midX = (lastX + currentX) / 2;
            const midY = (lastY + currentY) / 2;
            
            // Control point calculation: pull control point much closer to midpoint for very smooth curves
            // At max smoothing (100), control point is at 95% towards midpoint for maximum smoothness
            const controlX = lastX + (midX - lastX) * (0.05 + smoothingFactor * 0.95);
            const controlY = lastY + (midY - lastY) * (0.05 + smoothingFactor * 0.95);
            
            ctx.moveTo(lastX, lastY);
            ctx.quadraticCurveTo(controlX, controlY, midX, midY);
            ctx.stroke();
            
            // Update points for next iteration
            prevX = lastX;
            prevY = lastY;
            lastX = midX;
            lastY = midY;
        } else {
            // No smoothing - use straight lines
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            prevX = lastX;
            prevY = lastY;
            lastX = currentX;
            lastY = currentY;
        }
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        
        if (smoothing > 0) {
            // Enhanced smoothing using quadratic curves with very aggressive smoothing
            const smoothingFactor = smoothing / 100;
            const midX = (lastX + currentX) / 2;
            const midY = (lastY + currentY) / 2;
            
            // Control point calculation: pull control point much closer to midpoint for very smooth curves
            const controlX = lastX + (midX - lastX) * (0.05 + smoothingFactor * 0.95);
            const controlY = lastY + (midY - lastY) * (0.05 + smoothingFactor * 0.95);
            
            ctx.moveTo(lastX, lastY);
            ctx.quadraticCurveTo(controlX, controlY, midX, midY);
            ctx.stroke();
            
            prevX = lastX;
            prevY = lastY;
            lastX = midX;
            lastY = midY;
        } else {
            // No smoothing - use straight lines
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            prevX = lastX;
            prevY = lastY;
            lastX = currentX;
            lastY = currentY;
        }
    }
    // Rectangle, circle, and line are drawn only on mouseup
}

function stopDrawing(e) {
    if (!isDrawing) return;
    
    if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line') {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;
        
        const colorPicker = document.getElementById('minipaintColorPicker');
        const brushSizeSlider = document.getElementById('minipaintBrushSize');
        const color = colorPicker ? colorPicker.value : '#000000';
        const size = brushSizeSlider ? parseInt(brushSizeSlider.value) : 5;
        
        ctx.globalCompositeOperation = 'source-over';
        
        if (currentTool === 'rectangle') {
            // Draw filled rectangle
            ctx.fillStyle = color;
            ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        } else if (currentTool === 'circle') {
            // Draw filled circle
            const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.fill();
        } else if (currentTool === 'line') {
            // Draw stroked line (lines remain as strokes)
            ctx.strokeStyle = color;
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
        }
    }
    // Reset flag for next action
    stateSavedForCurrentAction = false;
    
    isDrawing = false;
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                     e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// Selection tool functions
function handleSelectionClick(e) {
    // NOTE: Selection tool should NEVER save to history - it only draws overlay
    // Selection is a visual tool only, not a drawing operation
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // If there's already a finished selection, check if clicking near the first vertex
    // Only clear finished selections when clicking away - unfinished selections should continue building
    if (isSelectionActive && selectionVertices.length > 2) {
        // Finished selection
        const firstVertex = selectionVertices[0];
        const distance = Math.sqrt(Math.pow(x - firstVertex.x, 2) + Math.pow(y - firstVertex.y, 2));
        
        if (distance < 10) {
            // Clicking near first vertex - already finished, do nothing
            return;
        } else {
            // Clicking away from first vertex - clear old finished selection and start new one
            selectionVertices = [];
            isSelectionActive = false;
            isSelectionInverted = false;
            lastSelectionClickTime = 0;
            updateInvertButtonVisibility();
            updateFillButtonVisibility();
            // Redraw canvas without the old selection
            redrawCanvasWithSelection();
            // Continue to add first vertex of new selection below
        }
    } else if (!isSelectionActive && selectionVertices.length > 2) {
        // Unfinished selection (has 3+ vertices but not finished yet)
        // Check if clicking near first vertex to finish it
        const firstVertex = selectionVertices[0];
        const distance = Math.sqrt(Math.pow(x - firstVertex.x, 2) + Math.pow(y - firstVertex.y, 2));
        if (distance < 10) {
            // Clicking near first vertex - finish the current selection
            finishSelection();
            return;
        }
        // Otherwise, continue adding vertices (don't clear)
    }
    
    // Check if this might be part of a double-click
    const now = Date.now();
    const isPotentialDoubleClick = (now - lastSelectionClickTime) < DOUBLE_CLICK_DELAY;
    
    // Add new vertex
    selectionVertices.push({ x, y });
    isSelectionActive = false; // Not finished until double-click or clicking near first vertex
    updateInvertButtonVisibility();
    updateFillButtonVisibility();
    
    // Update last click time
    lastSelectionClickTime = now;
    
    // Redraw canvas with selection preview
    redrawCanvasWithSelection();
    
    // If this was a potential double-click, wait a bit to see if double-click fires
    // If double-click fires, it will remove this vertex
    if (isPotentialDoubleClick) {
        setTimeout(() => {
            // If double-click didn't fire, the vertex stays
            // Just redraw to ensure selection is visible
            redrawCanvasWithSelection();
        }, DOUBLE_CLICK_DELAY + 50);
    }
}

function finishSelection() {
    // NOTE: Finishing selection does NOT save to history - selection is visual only
    
    if (selectionVertices.length < 3) {
        // Need at least 3 vertices for a valid polygon
        clearSelection();
        return;
    }
    
    // Selection is now complete and active
    isSelectionActive = true;
    isSelectionInverted = false; // Reset inversion when finishing a new selection
    updateInvertButtonVisibility();
    updateFillButtonVisibility();
    redrawCanvasWithSelection();
}

function clearSelection() {
    selectionVertices = [];
    isSelectionActive = false;
    isSelectionInverted = false;
    lastSelectionClickTime = 0;
    updateInvertButtonVisibility();
    updateFillButtonVisibility();
    
    // Redraw canvas without selection - get the clean image from history
    if (canvas && ctx) {
        const img = new Image();
        img.onload = () => {
            // Clear everything first
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw the clean image (without any overlays)
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(img, 0, 0);
        };
        // Always get from history (which should be clean, without overlays)
        if (historyIndex >= 0 && historyIndex < historyStack.length) {
            img.src = historyStack[historyIndex];
        } else if (currentImage) {
            img.src = currentImage.dataUrl;
        }
    }
}

// Update debug gallery with history images
function updateDebugGallery() {
    const debugGallery = document.getElementById('minipaintDebugGallery');
    const debugModeCheckbox = document.getElementById('minipaintDebugMode');
    
    if (!debugGallery || !debugModeCheckbox || !debugModeCheckbox.checked) {
        return;
    }
    
    // Clear existing gallery items
    debugGallery.innerHTML = '';
    
    // Display all images in history stack
    historyStack.forEach((imageDataUrl, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'minipaint-debug-gallery-item';
        
        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.alt = `History state ${index}`;
        
        const label = document.createElement('div');
        label.className = 'minipaint-debug-gallery-item-label';
        label.textContent = `State ${index}${index === historyIndex ? ' (current)' : ''}`;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'minipaint-debug-gallery-item-download';
        downloadBtn.textContent = 'Download';
        downloadBtn.title = 'Download this state';
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadHistoryImage(imageDataUrl, index);
        });
        
        galleryItem.appendChild(img);
        galleryItem.appendChild(label);
        galleryItem.appendChild(downloadBtn);
        
        debugGallery.appendChild(galleryItem);
    });
}

// Download a history image
function downloadHistoryImage(imageDataUrl, index) {
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `minipaint-history-state-${index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function drawSelectionPreview(e) {
    if (!canvas || !ctx || selectionVertices.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;
    
    // Redraw canvas with preview line
    redrawCanvasWithSelection(currentX, currentY);
}

function redrawCanvasWithSelection(previewX = null, previewY = null) {
    // NOTE: This function only draws the selection overlay - it does NOT save to history
    // Selection overlays are temporary visual indicators only
    
    if (!canvas || !ctx) return;
    
    // Restore canvas from history
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        drawSelectionOverlay(previewX, previewY, img);
    };
    img.onerror = () => {
        // If image fails to load, still try to draw selection on current canvas
        drawSelectionOverlay(previewX, previewY, null);
    };
    
    if (historyIndex >= 0 && historyIndex < historyStack.length) {
        img.src = historyStack[historyIndex];
    } else if (currentImage) {
        img.src = currentImage.dataUrl;
    } else {
        // No image source, just draw selection on current canvas
        drawSelectionOverlay(previewX, previewY, null);
    }
}

function drawSelectionBordersOnly() {
    if (!canvas || !ctx || selectionVertices.length === 0) return;
    
    // Draw only the selection borders (no fill overlay)
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(selectionVertices[0].x, selectionVertices[0].y);
    
    for (let i = 1; i < selectionVertices.length; i++) {
        ctx.lineTo(selectionVertices[i].x, selectionVertices[i].y);
    }
    
    // Close the polygon if selection is finished
    if (isSelectionActive && selectionVertices.length > 2) {
        ctx.closePath();
    }
    
    // Stroke the path (will draw lines between vertices)
    if (selectionVertices.length > 1 || (isSelectionActive && selectionVertices.length > 2)) {
        ctx.stroke();
    }
    
    // If only one vertex, draw a point to show it
    if (selectionVertices.length === 1) {
        ctx.beginPath();
        ctx.arc(selectionVertices[0].x, selectionVertices[0].y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#00ff00';
        ctx.fill();
    }
    
    ctx.setLineDash([]);
}

function drawSelectionOverlay(previewX = null, previewY = null, baseImage = null) {
    if (!canvas || !ctx) return;
    
    if (selectionVertices.length > 0) {
        // Draw selection polygon
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(selectionVertices[0].x, selectionVertices[0].y);
        
        for (let i = 1; i < selectionVertices.length; i++) {
            ctx.lineTo(selectionVertices[i].x, selectionVertices[i].y);
        }
        
        // Draw preview line to current mouse position (only if selection is not finished)
        if (previewX !== null && previewY !== null && !isSelectionActive) {
            ctx.lineTo(previewX, previewY);
        } else if (isSelectionActive && selectionVertices.length > 2) {
            // Close the polygon if selection is finished
            ctx.closePath();
        }
        
        // Stroke the path (will draw lines between vertices)
        if (selectionVertices.length > 1 || (previewX !== null && previewY !== null) || (isSelectionActive && selectionVertices.length > 2)) {
            ctx.stroke();
        }
        
        // If only one vertex and no preview, draw a point to show it
        if (selectionVertices.length === 1 && previewX === null && previewY === null) {
            ctx.beginPath();
            ctx.arc(selectionVertices[0].x, selectionVertices[0].y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#00ff00';
            ctx.fill();
        }
        
        ctx.setLineDash([]);
        
        // Fill selection with semi-transparent overlay
        if (isSelectionActive && selectionVertices.length > 2) {
            if (isSelectionInverted) {
                // For inverted selection: show overlay in the frame area (between polygon and canvas edges)
                // Same approach as normal selection, just with reversed boundaries
                ctx.save();
                
                // Fill entire canvas with overlay (this fills the frame area)
                ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Create a path for the polygon
                const path = new Path2D();
                path.moveTo(selectionVertices[0].x, selectionVertices[0].y);
                for (let i = 1; i < selectionVertices.length; i++) {
                    path.lineTo(selectionVertices[i].x, selectionVertices[i].y);
                }
                path.closePath();
                
                // Restore the original image inside the polygon (preserve it like normal selection preserves outside)
                if (baseImage) {
                    ctx.save();
                    ctx.clip(path);
                    ctx.drawImage(baseImage, 0, 0);
                    ctx.restore();
                }
                
                ctx.restore();
            } else {
                // Normal selection - fill inside the polygon
                ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
                ctx.fill();
            }
        }
    }
}

function invertSelection() {
    if (!canvas || !ctx || !isSelectionActive || selectionVertices.length < 3) return;
    
    // Toggle selection inversion (inside <-> outside)
    isSelectionInverted = !isSelectionInverted;
    
    // Redraw to show the inverted selection
    redrawCanvasWithSelection();
}

function handleFillClick(e) {
    if (!canvas || !ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    const colorPicker = document.getElementById('minipaintColorPicker');
    const color = colorPicker ? colorPicker.value : '#000000';
    
    // If there's an active selection, fill the selection
    if (isSelectionActive && selectionVertices.length > 2) {
        fillSelection(color);
    } else {
        // Otherwise, do a flood fill at the clicked point
        floodFill(x, y, color);
    }
}

// Helper functions for blend modes
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
    h /= 360;
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function parseColor(color) {
    // Parse hex color (#RRGGBB or #RGB)
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return [r, g, b];
        } else if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return [r, g, b];
        }
    }
    // Parse rgb(r, g, b)
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
    }
    return [0, 0, 0]; // default to black
}

function fillSelection(color) {
    if (!canvas || !ctx || !isSelectionActive || selectionVertices.length < 3) return;
    
    // Get blend mode from dropdown
    const blendModeSelect = document.getElementById('minipaintBlendModeSelect');
    const blendMode = blendModeSelect ? blendModeSelect.value : 'normal';
    
    // Create a path for the selection
    const path = new Path2D();
    path.moveTo(selectionVertices[0].x, selectionVertices[0].y);
    for (let i = 1; i < selectionVertices.length; i++) {
        path.lineTo(selectionVertices[i].x, selectionVertices[i].y);
    }
    path.closePath();
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    
    // Get the original image from history (before any overlays)
    // IMPORTANT: First, restore the clean image (removing any selection overlays) BEFORE saving state
    // This ensures we save a clean state without the selection overlay
    const restoreImg = new Image();
    restoreImg.onload = () => {
        // First, clear the canvas and restore the clean image (removes any selection overlay/lines)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(restoreImg, 0, 0);
        
        // NOW save the clean state (before applying fill) - this ensures no overlay is saved
        saveStateBeforeAction();
        stateSavedForCurrentAction = false;
        
        if (blendMode === 'normal') {
            // Normal mode: fill entire canvas with selected color
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Create a path for the polygon
            const path = new Path2D();
            path.moveTo(selectionVertices[0].x, selectionVertices[0].y);
            for (let i = 1; i < selectionVertices.length; i++) {
                path.lineTo(selectionVertices[i].x, selectionVertices[i].y);
            }
            path.closePath();
            
            // Restore the original image in the area that should remain unchanged
            ctx.save();
            
            // Determine the clip area based on isSelectionInverted flag
            const clipPath = isSelectionInverted ? path : (() => {
                // For normal: create inverse path (canvas with polygon as hole) using even-odd
                const inverse = new Path2D();
                inverse.rect(0, 0, canvas.width, canvas.height);
                inverse.moveTo(selectionVertices[0].x, selectionVertices[0].y);
                for (let i = 1; i < selectionVertices.length; i++) {
                    inverse.lineTo(selectionVertices[i].x, selectionVertices[i].y);
                }
                inverse.closePath();
                return inverse;
            })();
            
            // Clip to preserve area and restore image
            ctx.clip(clipPath, isSelectionInverted ? 'nonzero' : 'evenodd');
            ctx.drawImage(restoreImg, 0, 0);
            ctx.restore();
        } else if (blendMode === 'color') {
            // Color mode: preserve luminance, replace chroma (GIMP behavior)
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Parse fill color
            const fillRgb = parseColor(color);
            const [fillH, fillS, fillL] = rgbToHsl(fillRgb[0], fillRgb[1], fillRgb[2]);
            
            // Create a mask to identify pixels in selection
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            
            if (isSelectionInverted) {
                // For inverted: fill entire canvas, then erase the path area
                maskCtx.fillStyle = 'white';
                maskCtx.fillRect(0, 0, canvas.width, canvas.height);
                maskCtx.globalCompositeOperation = 'destination-out';
                maskCtx.fillStyle = 'black';
                maskCtx.fill(path);
            } else {
                // For normal: fill only the path area
                maskCtx.fillStyle = 'white';
                maskCtx.fill(path);
            }
            
            const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Apply color blend mode to pixels in selection
            for (let i = 0; i < data.length; i += 4) {
                const maskIndex = i;
                const inSelection = maskData.data[maskIndex] > 128; // White pixel means in selection
                
                if (inSelection) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Get original pixel's HSL
                    const [origH, origS, origL] = rgbToHsl(r, g, b);
                    
                    // Preserve luminance, use fill color's hue and saturation
                    const [newR, newG, newB] = hslToRgb(fillH, fillS, origL);
                    
                    data[i] = newR;
                    data[i + 1] = newG;
                    data[i + 2] = newB;
                    // Alpha channel (data[i + 3]) remains unchanged
                }
            }
            
            // Put modified image data back
            ctx.putImageData(imageData, 0, 0);
        }
        
        // At this point, canvas has the fill applied and is completely clean
        // (no selection overlay or lines, since we restored the clean image first)
        // Save the clean state to history (without any selection overlay)
        saveState();
        stateSavedForCurrentAction = false;
        
        // After saving, redraw the selection overlay on top
        redrawCanvasWithSelection();
    };
    
    // Get the image from history (before the fill operation)
    if (historyIndex >= 0 && historyIndex < historyStack.length) {
        restoreImg.src = historyStack[historyIndex];
    } else if (currentImage) {
        restoreImg.src = currentImage.dataUrl;
    }
    // Early return, saveState will be called in onload
}

function floodFill(startX, startY, fillColor) {
    if (!canvas || !ctx) return;
    
    // Save state before filling
    saveStateBeforeAction();
    stateSavedForCurrentAction = false;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Get target color
    const startIndex = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];
    
    // Parse fill color
    const fillRgb = hexToRgb(fillColor);
    if (!fillRgb) return;
    
    // If target color matches fill color, do nothing
    if (targetR === fillRgb.r && targetG === fillRgb.g && targetB === fillRgb.b) {
        return;
    }
    
    // Flood fill algorithm
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Set();
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        
        if (visited.has(key)) continue;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // Check if pixel matches target color (with tolerance for anti-aliasing)
        if (Math.abs(r - targetR) <= 1 && 
            Math.abs(g - targetG) <= 1 && 
            Math.abs(b - targetB) <= 1 &&
            Math.abs(a - targetA) <= 1) {
            
            visited.add(key);
            data[index] = fillRgb.r;
            data[index + 1] = fillRgb.g;
            data[index + 2] = fillRgb.b;
            // Alpha stays the same
            
            // Add neighbors to stack
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Update history
    saveState();
    stateSavedForCurrentAction = false;
}

function updateInvertButtonVisibility() {
    const invertBtn = document.getElementById('minipaintInvertBtn');
    if (invertBtn) {
        if (isSelectionActive && selectionVertices.length > 2) {
            invertBtn.style.display = 'block';
        } else {
            invertBtn.style.display = 'none';
        }
    }
}

function updateFillButtonVisibility() {
    const fillBtn = document.getElementById('minipaintToolFill');
    const fillGroup = document.getElementById('minipaintFillGroup');
    const blendModeSelect = document.getElementById('minipaintBlendModeSelect');
    
    const hasSelection = selectionVertices.length > 0;
    const isFillTool = currentTool === 'fill';
    
    // Show Fill button if there's any selection in progress (finished or unfinished)
    if (fillBtn) {
        if (hasSelection) {
            fillBtn.style.display = 'flex';
        } else {
            fillBtn.style.display = 'none';
        }
    }
    
    // Show dropdown only when Fill tool is selected AND there's a selection
    if (blendModeSelect) {
        if (isFillTool && hasSelection) {
            blendModeSelect.style.display = 'block';
            // Apply background to group when dropdown is visible
            if (fillGroup) {
                fillGroup.style.background = '#e8e8e8';
            }
        } else {
            blendModeSelect.style.display = 'none';
            // Remove background when dropdown is hidden
            if (fillGroup) {
                fillGroup.style.background = 'transparent';
            }
        }
    }
    
    // Show/hide the group container - show if Fill button should be visible (hasSelection)
    if (fillGroup) {
        if (hasSelection) {
            fillGroup.style.display = 'flex';
        } else {
            fillGroup.style.display = 'none';
        }
    }
    
    // Also update Color Balance button visibility
    updateColorBalanceButtonVisibility();
}

function updateColorBalanceButtonVisibility() {
    const colorBalanceBtn = document.getElementById('minipaintToolColorBalance');
    if (colorBalanceBtn) {
        // Show Color Balance button if there's any selection in progress (finished or unfinished)
        if (selectionVertices.length > 0) {
            colorBalanceBtn.style.display = 'block';
        } else {
            colorBalanceBtn.style.display = 'none';
        }
    }
}

function updateBrushSizeGroupVisibility() {
    const brushSizeGroup = document.getElementById('minipaintBrushSizeGroup');
    
    if (brushSizeGroup) {
        // Show brush size group only when brush tool is selected
        if (currentTool === 'brush') {
            brushSizeGroup.style.display = 'flex';
            // Apply darker background when visible
            brushSizeGroup.style.background = '#e8e8e8';
        } else {
            brushSizeGroup.style.display = 'none';
            // Remove background when hidden
            brushSizeGroup.style.background = 'transparent';
        }
    }
}

function updateSmoothingGroupVisibility() {
    const smoothingGroup = document.getElementById('minipaintSmoothingGroup');
    
    if (smoothingGroup) {
        // Show smoothing group when brush tool is selected
        if (currentTool === 'brush') {
            smoothingGroup.style.display = 'flex';
            // Apply darker background when visible
            smoothingGroup.style.background = '#e8e8e8';
        } else {
            smoothingGroup.style.display = 'none';
            // Remove background when hidden
            smoothingGroup.style.background = 'transparent';
        }
    }
}

// Color Balance functionality
let colorBalanceValues = {
    shadows: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
    midtones: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
    highlights: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 }
};

let currentToneRange = 'shadows';
let colorBalanceOriginalImage = null; // Store original image for preview

function openColorBalanceModal() {
    if (!canvas || !ctx || selectionVertices.length === 0) return;
    
    const modal = document.getElementById('minipaintColorBalanceModal');
    if (!modal) return;
    
    // Hide selection fill overlay but keep borders visible when Color Balance window is shown
    // Get clean image from history and draw it with only selection borders (no fill)
    // Store the original image for preview
    const cleanImg = new Image();
    cleanImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(cleanImg, 0, 0);
        // Store the original image for preview
        colorBalanceOriginalImage = new Image();
        colorBalanceOriginalImage.onload = () => {
            // Draw initial preview (with reset values, this will just show the original image with borders)
            previewColorBalance();
        };
        colorBalanceOriginalImage.src = cleanImg.src;
    };
    if (historyIndex >= 0 && historyIndex < historyStack.length) {
        cleanImg.src = historyStack[historyIndex];
    } else if (currentImage) {
        cleanImg.src = currentImage.dataUrl;
    }
    
    // Reset values
    colorBalanceValues = {
        shadows: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
        midtones: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
        highlights: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 }
    };
    currentToneRange = 'shadows';
    
    // Update UI
    updateColorBalanceUI();
    
    // Show modal
    modal.classList.add('active');
    
    // Initialize event listeners
    initColorBalanceModal();
    
    // Initialize drag functionality
    initColorBalanceDrag();
    
    // Add click-outside-to-close handler
    setTimeout(() => {
        document.addEventListener('click', handleColorBalanceOutsideClick, true);
    }, 0);
}

function initColorBalanceModal() {
    // Tone range radio buttons
    const toneRangeInputs = document.querySelectorAll('input[name="colorBalanceToneRange"]');
    toneRangeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            currentToneRange = e.target.value;
            updateColorBalanceUI();
            previewColorBalance(); // Apply preview immediately
        });
    });
    
    // Sliders
    const cyanRedSlider = document.getElementById('colorBalanceCyanRed');
    const magentaGreenSlider = document.getElementById('colorBalanceMagentaGreen');
    const yellowBlueSlider = document.getElementById('colorBalanceYellowBlue');
    
    const cyanRedValue = document.getElementById('colorBalanceCyanRedValue');
    const magentaGreenValue = document.getElementById('colorBalanceMagentaGreenValue');
    const yellowBlueValue = document.getElementById('colorBalanceYellowBlueValue');
    
    if (cyanRedSlider && cyanRedValue) {
        cyanRedSlider.addEventListener('input', (e) => {
            colorBalanceValues[currentToneRange].cyanRed = parseInt(e.target.value);
            cyanRedValue.textContent = e.target.value;
            previewColorBalance(); // Apply preview immediately
        });
    }
    
    if (magentaGreenSlider && magentaGreenValue) {
        magentaGreenSlider.addEventListener('input', (e) => {
            colorBalanceValues[currentToneRange].magentaGreen = parseInt(e.target.value);
            magentaGreenValue.textContent = e.target.value;
            previewColorBalance(); // Apply preview immediately
        });
    }
    
    if (yellowBlueSlider && yellowBlueValue) {
        yellowBlueSlider.addEventListener('input', (e) => {
            colorBalanceValues[currentToneRange].yellowBlue = parseInt(e.target.value);
            yellowBlueValue.textContent = e.target.value;
            previewColorBalance(); // Apply preview immediately
        });
    }
    
    // Buttons
    const resetBtn = document.getElementById('minipaintColorBalanceReset');
    const cancelBtn = document.getElementById('minipaintColorBalanceCancel');
    const applyBtn = document.getElementById('minipaintColorBalanceApply');
    const closeBtn = document.getElementById('minipaintColorBalanceModalClose');
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            colorBalanceValues[currentToneRange] = { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 };
            updateColorBalanceUI();
            previewColorBalance(); // Apply preview immediately
        });
    }
    
    if (cancelBtn || closeBtn) {
        const closeModal = () => {
            closeColorBalanceModal(true); // Restore original image when canceling
        };
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
    }
    
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            applyColorBalance();
            closeColorBalanceModal(false); // Don't restore original when applying
        });
    }
}

function closeColorBalanceModal(restoreOriginal = false) {
    const modal = document.getElementById('minipaintColorBalanceModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Remove click-outside handler
    document.removeEventListener('click', handleColorBalanceOutsideClick, true);
    
    // If canceling (not applying), restore the original image
    if (restoreOriginal && colorBalanceOriginalImage) {
        const restoreImg = new Image();
        restoreImg.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(restoreImg, 0, 0);
            // Restore selection overlay
            if (selectionVertices.length > 0) {
                redrawCanvasWithSelection();
            }
        };
        restoreImg.src = colorBalanceOriginalImage.src;
    } else {
        // Restore selection overlay when window is closed (selection is NOT affected)
        if (selectionVertices.length > 0) {
            redrawCanvasWithSelection();
        }
    }
}

function handleColorBalanceOutsideClick(e) {
    const modal = document.getElementById('minipaintColorBalanceModal');
    const modalContent = modal ? modal.querySelector('.minipaint-color-balance-modal-content') : null;
    
    if (modal && modal.classList.contains('active')) {
        // Check if click is outside the modal content
        if (modalContent && !modalContent.contains(e.target) && !e.target.closest('.minipaint-color-balance-modal-content')) {
            closeColorBalanceModal(true); // Restore original image when clicking outside
        }
    }
}

function initColorBalanceDrag() {
    const modal = document.getElementById('minipaintColorBalanceModal');
    const header = modal ? modal.querySelector('.minipaint-color-balance-modal-header') : null;
    
    if (!modal || !header) return;
    
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    
    header.addEventListener('mousedown', (e) => {
        // Don't start drag if clicking on close button or other interactive elements
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        
        isDragging = true;
        initialX = e.clientX - (parseFloat(modal.style.left) || 0);
        initialY = e.clientY - (parseFloat(modal.style.top) || 0);
        
        // Get current position if not set
        if (!modal.style.left || !modal.style.top) {
            const rect = modal.getBoundingClientRect();
            initialX = e.clientX - rect.left;
            initialY = e.clientY - rect.top;
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        // Keep modal within viewport
        const modalRect = modal.getBoundingClientRect();
        const maxX = window.innerWidth - modalRect.width;
        const maxY = window.innerHeight - modalRect.height;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));
        
        modal.style.left = currentX + 'px';
        modal.style.top = currentY + 'px';
        modal.style.transform = 'none';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function updateColorBalanceUI() {
    const values = colorBalanceValues[currentToneRange];
    
    const cyanRedSlider = document.getElementById('colorBalanceCyanRed');
    const magentaGreenSlider = document.getElementById('colorBalanceMagentaGreen');
    const yellowBlueSlider = document.getElementById('colorBalanceYellowBlue');
    
    const cyanRedValue = document.getElementById('colorBalanceCyanRedValue');
    const magentaGreenValue = document.getElementById('colorBalanceMagentaGreenValue');
    const yellowBlueValue = document.getElementById('colorBalanceYellowBlueValue');
    
    if (cyanRedSlider && cyanRedValue) {
        cyanRedSlider.value = values.cyanRed;
        cyanRedValue.textContent = values.cyanRed;
    }
    
    if (magentaGreenSlider && magentaGreenValue) {
        magentaGreenSlider.value = values.magentaGreen;
        magentaGreenValue.textContent = values.magentaGreen;
    }
    
    if (yellowBlueSlider && yellowBlueValue) {
        yellowBlueSlider.value = values.yellowBlue;
        yellowBlueValue.textContent = values.yellowBlue;
    }
    
    // Update radio buttons
    const toneRangeInputs = document.querySelectorAll('input[name="colorBalanceToneRange"]');
    toneRangeInputs.forEach(input => {
        if (input.value === currentToneRange) {
            input.checked = true;
        }
    });
}

function previewColorBalance() {
    if (!canvas || !ctx || !colorBalanceOriginalImage || selectionVertices.length < 3) return;
    
    // Create a path for the selection
    const path = new Path2D();
    path.moveTo(selectionVertices[0].x, selectionVertices[0].y);
    for (let i = 1; i < selectionVertices.length; i++) {
        path.lineTo(selectionVertices[i].x, selectionVertices[i].y);
    }
    path.closePath();
    
    // Restore the original image (for preview, don't save to history)
    const previewImg = new Image();
    previewImg.onload = () => {
        // Clear canvas and restore original image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(previewImg, 0, 0);
        
        // Get image data for color balance processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create a mask to identify pixels in selection
        // For normal selection: process pixels inside path
        // For inverted selection: process pixels outside path
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        if (isSelectionInverted) {
            // For inverted: fill entire canvas, then erase the path area
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, canvas.width, canvas.height);
            maskCtx.globalCompositeOperation = 'destination-out';
            maskCtx.fillStyle = 'black';
            maskCtx.fill(path);
        } else {
            // For normal: fill only the path area
            maskCtx.fillStyle = 'white';
            maskCtx.fill(path);
        }
        
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply color balance to pixels in selection
        for (let i = 0; i < data.length; i += 4) {
            const maskIndex = i;
            const inSelection = maskData.data[maskIndex] > 128; // White pixel means in selection
            
            if (inSelection) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                
                // Determine tone range (shadows, midtones, highlights)
                const brightness = (r + g + b) / 3;
                let toneRange;
                if (brightness < 85) {
                    toneRange = 'shadows';
                } else if (brightness < 170) {
                    toneRange = 'midtones';
                } else {
                    toneRange = 'highlights';
                }
                
                const values = colorBalanceValues[toneRange];
                
                // Apply color balance adjustments (GIMP-style)
                // Cyan-Red: increase red = add to R, increase cyan = subtract from R
                r = Math.max(0, Math.min(255, r + values.cyanRed));
                
                // Magenta-Green: increase magenta = add to R and B, increase green = add to G
                r = Math.max(0, Math.min(255, r - values.magentaGreen * 0.5));
                g = Math.max(0, Math.min(255, g + values.magentaGreen));
                b = Math.max(0, Math.min(255, b - values.magentaGreen * 0.5));
                
                // Yellow-Blue: increase yellow = add to R and G, increase blue = add to B
                r = Math.max(0, Math.min(255, r + values.yellowBlue * 0.5));
                g = Math.max(0, Math.min(255, g + values.yellowBlue * 0.5));
                b = Math.max(0, Math.min(255, b - values.yellowBlue));
                
                data[i] = Math.round(r);
                data[i + 1] = Math.round(g);
                data[i + 2] = Math.round(b);
            }
        }
        
        // Put modified image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Draw selection borders on top (no fill overlay)
        drawSelectionBordersOnly();
    };
    
    // Use the stored original image
    previewImg.src = colorBalanceOriginalImage.src;
}

function applyColorBalance() {
    if (!canvas || !ctx || selectionVertices.length < 3) return;
    
    // Create a path for the selection
    const path = new Path2D();
    path.moveTo(selectionVertices[0].x, selectionVertices[0].y);
    for (let i = 1; i < selectionVertices.length; i++) {
        path.lineTo(selectionVertices[i].x, selectionVertices[i].y);
    }
    path.closePath();
    
    // Get the original image from history (before any overlays)
    // IMPORTANT: First, restore the clean image (removing any selection overlays) BEFORE saving state
    // This ensures we save a clean state without the selection overlay
    const restoreImg = new Image();
    restoreImg.onload = () => {
        // First, clear the canvas and restore the clean image (removes any selection overlay/lines)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(restoreImg, 0, 0);
        
        // NOW save the clean state (before applying color balance) - this ensures no overlay is saved
        saveStateBeforeAction();
        stateSavedForCurrentAction = false;
        
        // Get image data for color balance processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create a mask to identify pixels in selection
        // For normal selection: process pixels inside path
        // For inverted selection: process pixels outside path
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        if (isSelectionInverted) {
            // For inverted: fill entire canvas, then erase the path area
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, canvas.width, canvas.height);
            maskCtx.globalCompositeOperation = 'destination-out';
            maskCtx.fillStyle = 'black';
            maskCtx.fill(path);
        } else {
            // For normal: fill only the path area
            maskCtx.fillStyle = 'white';
            maskCtx.fill(path);
        }
        
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply color balance to pixels in selection
        for (let i = 0; i < data.length; i += 4) {
            const maskIndex = i;
            const inSelection = maskData.data[maskIndex] > 128; // White pixel means in selection
            
            if (inSelection) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                
                // Determine tone range (shadows, midtones, highlights)
                const brightness = (r + g + b) / 3;
                let toneRange;
                if (brightness < 85) {
                    toneRange = 'shadows';
                } else if (brightness < 170) {
                    toneRange = 'midtones';
                } else {
                    toneRange = 'highlights';
                }
                
                const values = colorBalanceValues[toneRange];
                
                // Apply color balance adjustments (GIMP-style)
                // Cyan-Red: increase red = add to R, increase cyan = subtract from R
                r = Math.max(0, Math.min(255, r + values.cyanRed));
                
                // Magenta-Green: increase magenta = add to R and B, increase green = add to G
                r = Math.max(0, Math.min(255, r - values.magentaGreen * 0.5));
                g = Math.max(0, Math.min(255, g + values.magentaGreen));
                b = Math.max(0, Math.min(255, b - values.magentaGreen * 0.5));
                
                // Yellow-Blue: increase yellow = add to R and G, increase blue = add to B
                r = Math.max(0, Math.min(255, r + values.yellowBlue * 0.5));
                g = Math.max(0, Math.min(255, g + values.yellowBlue * 0.5));
                b = Math.max(0, Math.min(255, b - values.yellowBlue));
                
                data[i] = Math.round(r);
                data[i + 1] = Math.round(g);
                data[i + 2] = Math.round(b);
            }
        }
        
        // Put modified image data back
        ctx.putImageData(imageData, 0, 0);
        
        // At this point, canvas has the color balance applied and is completely clean
        // (no selection overlay or lines, since we restored the clean image first)
        // Save the clean state to history (without any selection overlay)
        saveState();
        stateSavedForCurrentAction = false;
        
        // After saving, redraw the selection overlay on top (selection is NOT cancelled)
        redrawCanvasWithSelection();
    };
    
    // Get image from history
    if (historyIndex >= 0 && historyIndex < historyStack.length) {
        restoreImg.src = historyStack[historyIndex];
    } else if (currentImage) {
        restoreImg.src = currentImage.dataUrl;
    }
}

