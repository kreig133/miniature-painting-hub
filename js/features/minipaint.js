/**
 * Minipaint feature - Canvas-based image editor
 */

import { getCurrentModel, getPalleteWithMappings } from '../core/state.js';
import { getImages, saveImage } from '../utils/imageStorage.js';
import { getPalette, addColorToPalette } from './palette.js';
import { hexToRgb, rgbToHSV } from '../utils/colorUtils.js';

let currentTool = 'brush';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let startX = 0;
let startY = 0;
let currentImage = null;
let canvas = null;
let ctx = null;
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

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
    
    // Load image onto canvas
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        // Initialize history with the initial image state
        saveState();
    };
    img.src = image.dataUrl;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load palette colors
    loadPaletteColors();
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
}

// Save current canvas state to history
function saveState() {
    if (!canvas || !ctx) return;
    
    // Remove any states after current index (for redo functionality, if needed)
    historyStack = historyStack.slice(0, historyIndex + 1);
    
    // Save current state
    const state = canvas.toDataURL('image/png');
    historyStack.push(state);
    historyIndex++;
    
    // Limit history size
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
        historyIndex--;
    }
    
    updateUndoButton();
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
    
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
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
                currentTool = btn.getAttribute('data-tool');
            });
        });
    }
    
    // Brush size slider
    if (brushSizeSlider && brushSizeValue) {
        brushSizeSlider.addEventListener('input', (e) => {
            brushSizeValue.textContent = e.target.value;
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
            const useAssignedPaints = colorSourceToggle && !colorSourceToggle.checked;
            if (!useAssignedPaints) {
                loadPaletteColors(false);
            }
        });
    }
    
    // Color source toggle (Palette / Assigned Paints)
    const colorSourceToggle = document.getElementById('minipaintColorSourceToggle');
    if (colorSourceToggle) {
        colorSourceToggle.addEventListener('change', (e) => {
            const useAssignedPaints = !e.target.checked; // When unchecked, use assigned paints
            loadPaletteColors(useAssignedPaints);
        });
    }
    
    // Undo button
    if (undoBtn) {
        undoBtn.addEventListener('click', undo);
        updateUndoButton();
    }
    
    // Keyboard shortcuts (Ctrl+Z / Cmd+Z for undo)
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('minipaintModal');
        if (!modal || !modal.classList.contains('active')) return;
        
        // Check if we're in an input field (don't override browser undo in inputs)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
    });
    
    // Canvas drawing
    if (canvas && ctx) {
        // Mouse events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
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
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;
    startX = lastX;
    startY = lastY;
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
    const color = colorPicker ? colorPicker.value : '#000000';
    const size = brushSizeSlider ? parseInt(brushSizeSlider.value) : 5;
    
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        lastX = currentX;
        lastY = currentY;
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        lastX = currentX;
        lastY = currentY;
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
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        
        if (currentTool === 'rectangle') {
            ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
            ctx.beginPath();
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (currentTool === 'line') {
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

