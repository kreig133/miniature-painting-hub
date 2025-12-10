/**
 * Image picker feature - handles image upload, canvas, and color picking
 */

import { rgbToHex } from '../utils/colorUtils.js';
import { addGradientClickToColorBox } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox as addHoverTooltip } from '../utils/domUtils.js';
import { state, setCurrentColor, getCurrentColor } from '../core/state.js';

let imageUpload = null;
let imageSection = null;
let imageCanvas = null;
let cursorInfo = null;
let currentColorSection = null;
let colorPreview = null;
let hexValue = null;
let rgbValue = null;
let saveColorBtn = null;
let ctx = null;

// Magnifying glass elements
let imageMagnifyingGlass = null;
let imageMagnifyingCanvas = null;
let imageCanvasContainer = null;

// Animation throttling
let imageAnimationFrameId = null;
let imageLastUpdateTime = 0;
const imageThrottleDelay = 16; // ~60fps

// Callbacks for dependencies
let updateClosestMatches = null;
let findClosestFromPalette = null;
let findNthClosestFromPalette = null;
let findClosestFromMyCollection = null;
let findNthClosestFromMyCollection = null;
let findClosestFromPaintColors = null;
let addHoverTooltipToColorBox = null;
let addColorToPalette = null;

// Initialize image picker
export function initImagePicker(dependencies = {}) {
    // Get DOM elements
    imageUpload = document.getElementById('imageUpload');
    imageSection = document.getElementById('imageSection');
    imageCanvas = document.getElementById('imageCanvas');
    cursorInfo = document.getElementById('cursorInfo');
    currentColorSection = document.getElementById('currentColorSection');
    colorPreview = document.getElementById('colorPreview');
    hexValue = document.getElementById('hexValue');
    rgbValue = document.getElementById('rgbValue');
    saveColorBtn = document.getElementById('saveColorBtn');
    
    // Get canvas context
    if (imageCanvas) {
        ctx = imageCanvas.getContext('2d');
        state.ctx = ctx;
    }
    
    // Initialize magnifying glass
    imageMagnifyingGlass = document.getElementById('imageMagnifyingGlass');
    imageMagnifyingCanvas = document.getElementById('imageMagnifyingGlassCanvas');
    imageCanvasContainer = imageCanvas ? imageCanvas.parentElement : null;
    
    if (imageMagnifyingCanvas) {
        imageMagnifyingCanvas.width = 120;
        imageMagnifyingCanvas.height = 120;
    }
    
    // Set up dependencies
    if (dependencies.updateClosestMatches) {
        updateClosestMatches = dependencies.updateClosestMatches;
    }
    if (dependencies.findClosestFromPalette) {
        findClosestFromPalette = dependencies.findClosestFromPalette;
    }
    if (dependencies.findNthClosestFromPalette) {
        findNthClosestFromPalette = dependencies.findNthClosestFromPalette;
    }
    if (dependencies.findClosestFromMyCollection) {
        findClosestFromMyCollection = dependencies.findClosestFromMyCollection;
    }
    if (dependencies.findNthClosestFromMyCollection) {
        findNthClosestFromMyCollection = dependencies.findNthClosestFromMyCollection;
    }
    if (dependencies.findClosestFromPaintColors) {
        findClosestFromPaintColors = dependencies.findClosestFromPaintColors;
    }
    if (dependencies.addHoverTooltipToColorBox) {
        addHoverTooltipToColorBox = dependencies.addHoverTooltipToColorBox;
    }
    if (dependencies.addColorToPalette) {
        addColorToPalette = dependencies.addColorToPalette;
    }
    
    // Image upload handler
    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        // Set canvas size to match image (max width 800px for better UX)
                        const maxWidth = 800;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                        
                        imageCanvas.width = width;
                        imageCanvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        if (imageSection) {
                            imageSection.style.display = 'block';
                        }
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Color picker on canvas click
    if (imageCanvas) {
        imageCanvas.addEventListener('click', (e) => {
            const rect = imageCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Get pixel data
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const r = pixel[0];
            const g = pixel[1];
            const b = pixel[2];
            
            // Convert to hex
            const hex = rgbToHex(r, g, b);
            
            // Update current color
            setCurrentColor({ r, g, b, hex });
            displayCurrentColor();
        });
        
        // Show color info on mouse move with magnifying glass
        imageCanvas.addEventListener('mousemove', (e) => {
            const now = performance.now();
            if (now - imageLastUpdateTime < imageThrottleDelay) {
                return;
            }
            imageLastUpdateTime = now;
            
            if (imageAnimationFrameId) {
                cancelAnimationFrame(imageAnimationFrameId);
            }
            
            imageAnimationFrameId = requestAnimationFrame(() => {
                const rect = imageCanvas.getBoundingClientRect();
                const scaleX = imageCanvas.width / rect.width;
                const scaleY = imageCanvas.height / rect.height;
                const x = Math.floor((e.clientX - rect.left) * scaleX);
                const y = Math.floor((e.clientY - rect.top) * scaleY);
                
                if (x >= 0 && x < imageCanvas.width && y >= 0 && y < imageCanvas.height) {
                    const pixel = ctx.getImageData(x, y, 1, 1).data;
                    const r = pixel[0];
                    const g = pixel[1];
                    const b = pixel[2];
                    const hex = rgbToHex(r, g, b);
                    
                    if (cursorInfo) {
                        cursorInfo.textContent = `X: ${x}, Y: ${y} | ${hex}`;
                        cursorInfo.style.display = 'block';
                        cursorInfo.style.left = `${e.clientX - rect.left + 10}px`;
                        cursorInfo.style.top = `${e.clientY - rect.top + 10}px`;
                    }
                    
                    // Show and update magnifying glass
                    if (imageMagnifyingGlass && imageMagnifyingCanvas && imageCanvasContainer) {
                        const containerRect = imageCanvasContainer.getBoundingClientRect();
                        const glassSize = 120;
                        const glassX = e.clientX - containerRect.left - glassSize / 2;
                        const glassY = e.clientY - containerRect.top - glassSize / 2;
                        
                        imageMagnifyingGlass.style.display = 'block';
                        imageMagnifyingGlass.style.left = glassX + 'px';
                        imageMagnifyingGlass.style.top = glassY + 'px';
                        
                        // Create magnified view using canvas directly
                        const zoom = 2;
                        const sourceSize = glassSize / zoom;
                        const sourceX = x - sourceSize / 2;
                        const sourceY = y - sourceSize / 2;
                        
                        const magCtx = imageMagnifyingCanvas.getContext('2d');
                        
                        // Clear and draw the magnified area
                        magCtx.clearRect(0, 0, glassSize, glassSize);
                        magCtx.save();
                        magCtx.beginPath();
                        magCtx.arc(glassSize / 2, glassSize / 2, glassSize / 2, 0, 2 * Math.PI);
                        magCtx.clip();
                        
                        magCtx.drawImage(
                            imageCanvas,
                            sourceX, sourceY, sourceSize, sourceSize,
                            0, 0, glassSize, glassSize
                        );
                        
                        magCtx.restore();
                    }
                } else {
                    // Hide magnifying glass when outside canvas
                    if (imageMagnifyingGlass) {
                        imageMagnifyingGlass.style.display = 'none';
                    }
                    if (cursorInfo) {
                        cursorInfo.style.display = 'none';
                    }
                }
            });
        });
        
        imageCanvas.addEventListener('mouseleave', () => {
            if (imageAnimationFrameId) {
                cancelAnimationFrame(imageAnimationFrameId);
            }
            if (imageMagnifyingGlass) {
                imageMagnifyingGlass.style.display = 'none';
            }
            if (cursorInfo) {
                cursorInfo.style.display = 'none';
            }
        });
    }
    
    // Save color button
    if (saveColorBtn) {
        saveColorBtn.addEventListener('click', () => {
            const currentColor = getCurrentColor();
            if (!currentColor) return;
            
            if (addColorToPalette) {
                if (addColorToPalette({ ...currentColor })) {
                    // Color added successfully
                } else {
                    alert('This color is already in your palette!');
                }
            }
        });
    }
}

// Display current color
export function displayCurrentColor() {
    const currentColor = getCurrentColor();
    if (!currentColor) return;
    
    if (colorPreview) {
        colorPreview.style.backgroundColor = currentColor.hex;
    }
    if (hexValue) {
        hexValue.value = currentColor.hex.toUpperCase();
    }
    if (rgbValue) {
        rgbValue.value = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
    }
    if (currentColorSection) {
        currentColorSection.style.display = 'block';
    }
    
    // Find and display closest matches
    if (updateClosestMatches) {
        updateClosestMatches();
    }
}

// Update closest matches display
export function updateClosestMatchesDisplay() {
    const currentColor = getCurrentColor();
    if (!currentColor) return;
    
    // Find closest from palette (no filters - always from user's palette)
    // Use selectedColorSaturationThreshold for Palette Editor context
    const palette1 = findClosestFromPalette ? findClosestFromPalette(currentColor, true) : null;
    const palette2 = findNthClosestFromPalette ? findNthClosestFromPalette(currentColor, 2, true) : null;
    
    // Find closest from my collection (apply filters)
    const collection1 = findClosestFromMyCollection ? findClosestFromMyCollection(currentColor, 'selectedColorFilters') : null;
    const collection2 = findNthClosestFromMyCollection ? findNthClosestFromMyCollection(currentColor, 2, 'selectedColorFilters') : null;
    
    // Update Palette 1
    const palette1Color = document.getElementById('palette1Color');
    if (palette1Color) {
        if (palette1) {
            palette1Color.style.backgroundColor = palette1.hex;
            palette1Color.style.display = 'block';
            addGradientClickToColorBox(palette1Color, palette1.hex);
        } else {
            palette1Color.style.display = 'none';
        }
    }
    
    // Update Palette 2
    const palette2Color = document.getElementById('palette2Color');
    if (palette2Color) {
        if (palette2) {
            palette2Color.style.backgroundColor = palette2.hex;
            palette2Color.style.display = 'block';
            addGradientClickToColorBox(palette2Color, palette2.hex);
        } else {
            palette2Color.style.display = 'none';
        }
    }
    
    // Helper function to remove old tooltip
    function removeTooltip(colorBox) {
        if (colorBox._tooltipElement && colorBox._tooltipElement.parentNode) {
            colorBox._tooltipElement.remove();
        }
        delete colorBox._tooltipElement;
        delete colorBox.dataset.tooltipAttached;
        delete colorBox.dataset.colorName;
        delete colorBox.dataset.colorType;
        delete colorBox.dataset.colorProducer;
    }
    
    // Helper function to update a match color box
    function updateMatchColorBox(elementId, match, hasTooltip = false) {
        const colorBox = document.getElementById(elementId);
        if (!colorBox) return;
        
        if (match) {
            colorBox.style.backgroundColor = match.hex;
            colorBox.style.display = 'block';
            addGradientClickToColorBox(colorBox, match.hex);
            
            if (hasTooltip && (match.name || match.producer || match.type)) {
                // Update tooltip data
                colorBox.dataset.colorName = match.name || '';
                colorBox.dataset.colorType = Array.isArray(match.type) ? match.type.join(', ') : (match.type || '');
                colorBox.dataset.colorProducer = match.producer || '';
                
                // Add/update hover tooltip (will update content if already exists)
                if (addHoverTooltipToColorBox) {
                    addHoverTooltipToColorBox(colorBox);
                }
            } else {
                // Remove tooltip if not needed
                removeTooltip(colorBox);
            }
        } else {
            colorBox.style.display = 'none';
            removeTooltip(colorBox);
        }
    }
    
    // Update Collection 1
    updateMatchColorBox('collection1Color', collection1, true);
    
    // Update Collection 2
    updateMatchColorBox('collection2Color', collection2, true);
    
    // Update "From All" (closest from Paint Colours)
    const fromAll = findClosestFromPaintColors ? findClosestFromPaintColors(currentColor, 'selectedColorFilters') : null;
    updateMatchColorBox('fromAllColor', fromAll, true);
}

