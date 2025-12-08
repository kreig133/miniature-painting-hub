/**
 * Color Wheel feature - handles color wheel rendering, interactions, and floating wheels
 */

import { rgbToHex, rgbToHSV, hsvToRGB, hexToRgb } from '../utils/colorUtils.js';
import { state, getPalette, getMyCollection } from '../core/state.js';
import { savePaletteValueMiddle, savePaletteValueRange, saveCollectionValueMiddle, saveCollectionValueRange } from '../utils/storage.js';
import { filterData } from './filters.js';

// Canvas references
let colorWheelCanvas = null;
let colorWheelCtx = null;
let collectionWheelCanvas = null;
let collectionWheelCtx = null;

// Point positions (stored in state)
// Using state.palettePointPositions and state.collectionPointPositions

// Dependencies
let displayCurrentColor = null;
let updateColorWheelPreview = null;

// Draw color wheel base
function drawColorWheelBase() {
    if (!colorWheelCtx || !colorWheelCanvas) return;
    
    const ctx = colorWheelCtx;
    const size = colorWheelCanvas.width;
    const centerX = state.colorWheelCenterX;
    const centerY = state.colorWheelCenterY;
    const radius = state.colorWheelRadius;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Use ImageData for better performance
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    
    // Draw color wheel
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= radius) {
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                const saturation = Math.min(distance / radius, 1);
                const value = 1;
                
                const rgb = hsvToRGB(angle, saturation, value);
                
                const index = (y * size + x) * 4;
                data[index] = rgb.r;
                data[index + 1] = rgb.g;
                data[index + 2] = rgb.b;
                data[index + 3] = 255;
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add white center gradient for saturation
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Add black outer ring for value
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

// Draw palette colors as points on the color wheel
export function drawPalettePointsOnWheel() {
    if (!colorWheelCtx || !colorWheelCanvas) return;
    
    // Redraw the base wheel first to clear old points
    drawColorWheelBase();
    
    const ctx = colorWheelCtx;
    const centerX = state.colorWheelCenterX;
    const centerY = state.colorWheelCenterY;
    const radius = state.colorWheelRadius;
    
    // Clear previous point positions
    state.palettePointPositions = [];
    const pointRadius = 7;
    
    const palette = getPalette();
    
    // Calculate Value range (0-100 scale)
    const valueMin = state.paletteValueMiddle - (state.paletteValueRange / 2);
    const valueMax = state.paletteValueMiddle + (state.paletteValueRange / 2);
    
    // Draw each palette color as a point
    palette.forEach((color, index) => {
        // Convert RGB to HSV
        const hsv = rgbToHSV(color.r, color.g, color.b);
        
        // Convert Value from 0-1 to 0-100 for comparison
        const valuePercent = hsv.v * 100;
        
        // Filter by Value range
        if (valuePercent < valueMin || valuePercent > valueMax) {
            return;
        }
        
        // Calculate position on color wheel
        const angle = (hsv.h * Math.PI) / 180;
        const distance = hsv.s * radius;
        
        const x = centerX + distance * Math.cos(angle);
        const y = centerY + distance * Math.sin(angle);
        
        // Store point position for click detection
        state.palettePointPositions.push({
            x: x,
            y: y,
            radius: pointRadius,
            colorIndex: index,
            color: color
        });
        
        // Draw the color as a filled circle
        ctx.fillStyle = color.hex;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw white outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw black outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
    });
}

// Highlight and scroll to palette item
export function highlightAndScrollToPaletteItem(index) {
    document.querySelectorAll('.palette-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    
    const paletteItems = document.querySelectorAll('.palette-item');
    if (paletteItems[index]) {
        const item = paletteItems[index];
        item.classList.add('highlighted');
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
            item.classList.remove('highlighted');
        }, 2000);
    }
}

// Draw collection wheel base
function drawCollectionWheelBase() {
    if (!collectionWheelCtx || !collectionWheelCanvas) return;
    
    const ctx = collectionWheelCtx;
    const size = collectionWheelCanvas.width;
    const centerX = state.collectionWheelCenterX;
    const centerY = state.collectionWheelCenterY;
    const radius = state.collectionWheelRadius;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Use ImageData for better performance
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    
    // Draw color wheel
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= radius) {
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                const saturation = Math.min(distance / radius, 1);
                const value = 1;
                
                const rgb = hsvToRGB(angle, saturation, value);
                
                const index = (y * size + x) * 4;
                data[index] = rgb.r;
                data[index + 1] = rgb.g;
                data[index + 2] = rgb.b;
                data[index + 3] = 255;
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add white center gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Add black outer ring
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

// Draw collection points on wheel
export function drawCollectionPointsOnWheel() {
    if (!collectionWheelCtx || !collectionWheelCanvas) return;
    
    // Redraw the base wheel first
    drawCollectionWheelBase();
    
    const ctx = collectionWheelCtx;
    const centerX = state.collectionWheelCenterX;
    const centerY = state.collectionWheelCenterY;
    const radius = state.collectionWheelRadius;
    
    // Clear previous point positions
    state.collectionPointPositions = [];
    const pointRadius = 7;
    
    const myCollection = getMyCollection();
    
    // Apply filters to collection
    const filteredCollection = filterData ? filterData(myCollection, 'myCollectionFilters') : myCollection;
    
    // Calculate Value range
    const valueMin = state.collectionValueMiddle - (state.collectionValueRange / 2);
    const valueMax = state.collectionValueMiddle + (state.collectionValueRange / 2);
    
    // Draw each filtered collection color as a point
    filteredCollection.forEach((color) => {
        // Find the original index in myCollection
        const originalIndex = myCollection.findIndex(origItem => 
            origItem.hex === color.hex && 
            origItem.name === color.name &&
            origItem.producer === color.producer
        );
        
        // Convert hex to RGB if needed
        let r, g, b;
        if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
            r = color.r;
            g = color.g;
            b = color.b;
        } else {
            const rgb = hexToRgb(color.hex);
            if (!rgb) return;
            r = rgb.r;
            g = rgb.g;
            b = rgb.b;
        }
        
        // Convert RGB to HSV
        const hsv = rgbToHSV(r, g, b);
        
        // Convert Value from 0-1 to 0-100
        const valuePercent = hsv.v * 100;
        
        // Filter by Value range
        if (valuePercent < valueMin || valuePercent > valueMax) {
            return;
        }
        
        // Calculate position on color wheel
        const angle = (hsv.h * Math.PI) / 180;
        const distance = hsv.s * radius;
        
        const x = centerX + distance * Math.cos(angle);
        const y = centerY + distance * Math.sin(angle);
        
        // Store point position
        state.collectionPointPositions.push({
            x: x,
            y: y,
            radius: pointRadius,
            colorIndex: originalIndex,
            color: color
        });
        
        // Draw the color as a filled circle
        ctx.fillStyle = color.hex;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw white outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw black outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
    });
}

// Highlight and scroll to collection item
export function highlightAndScrollToCollectionItem(index) {
    const table = document.getElementById('myCollectionTable');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const myCollection = getMyCollection();
    if (index < 0 || index >= myCollection.length) return;
    const targetColor = myCollection[index];
    
    // Find the row in the filtered table
    const rows = tbody.querySelectorAll('tr');
    let targetRow = null;
    
    rows.forEach(row => {
        const colorBox = row.querySelector('.color-box');
        const nameSpan = row.querySelector('.paint-name');
        const producerCell = row.cells[2];
        
        if (colorBox && nameSpan && producerCell) {
            const rowHex = colorBox.style.backgroundColor;
            const rowName = nameSpan.textContent;
            const rowProducer = producerCell.textContent;
            
            const targetHex = targetColor.hex;
            const targetRgb = hexToRgb(targetHex);
            const targetRgbString = targetRgb ? `rgb(${targetRgb.r}, ${targetRgb.g}, ${targetRgb.b})` : targetHex;
            
            if (rowHex === targetRgbString || rowHex === targetHex) {
                if (rowName === targetColor.name && rowProducer === targetColor.producer) {
                    targetRow = row;
                }
            }
        }
    });
    
    if (targetRow) {
        rows.forEach(r => r.classList.remove('highlighted'));
        targetRow.classList.add('highlighted');
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
            targetRow.classList.remove('highlighted');
        }, 2000);
    }
}

// Update collection magnifying glass
function updateCollectionMagnifyingGlass(e, wrapper, canvas, magnifyingGlass, magnifyingCanvas) {
    if (!magnifyingGlass || !magnifyingCanvas || !canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - canvasRect.left;
    const canvasY = e.clientY - canvasRect.top;
    
    if (canvasX < 0 || canvasX > canvasRect.width || canvasY < 0 || canvasY > canvasRect.height) {
        magnifyingGlass.style.display = 'none';
        return;
    }
    
    const wrapperRect = wrapper.getBoundingClientRect();
    const glassSize = 120;
    const glassX = e.clientX - wrapperRect.left - glassSize / 2;
    const glassY = e.clientY - wrapperRect.top - glassSize / 2;
    
    magnifyingGlass.style.display = 'block';
    magnifyingGlass.style.left = glassX + 'px';
    magnifyingGlass.style.top = glassY + 'px';
    
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    const x = canvasX * scaleX;
    const y = canvasY * scaleY;
    
    const zoom = 2;
    const sourceSize = glassSize / zoom;
    const sourceX = x - sourceSize / 2;
    const sourceY = y - sourceSize / 2;
    
    const magCtx = magnifyingCanvas.getContext('2d');
    
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
    
    magCtx.restore();
}

// Update color wheel preview
function updateColorWheelPreviewFunc(r, g, b, hex) {
    const preview = document.getElementById('colorWheelPreview');
    const hexDisplay = document.getElementById('colorWheelHex');
    const rgbDisplay = document.getElementById('colorWheelRGB');
    
    if (preview) {
        preview.style.backgroundColor = hex;
    }
    if (hexDisplay) {
        hexDisplay.textContent = hex.toUpperCase();
    }
    if (rgbDisplay) {
        rgbDisplay.textContent = `rgb(${r}, ${g}, ${b})`;
    }
}

// Initialize color wheel
export function initColorWheel(dependencies = {}) {
    if (dependencies.displayCurrentColor) {
        displayCurrentColor = dependencies.displayCurrentColor;
    }
    if (dependencies.updateColorWheelPreview) {
        updateColorWheelPreview = dependencies.updateColorWheelPreview;
    } else {
        updateColorWheelPreview = updateColorWheelPreviewFunc;
    }
    
    const canvas = document.getElementById('colorWheelCanvas');
    if (!canvas) return;
    
    colorWheelCanvas = canvas;
    colorWheelCtx = canvas.getContext('2d');
    state.colorWheelCanvas = canvas;
    state.colorWheelCtx = colorWheelCtx;
    
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    
    state.colorWheelCenterX = size / 2;
    state.colorWheelCenterY = size / 2;
    state.colorWheelRadius = size / 2 - 10;
    
    // Draw color wheel base
    drawColorWheelBase();
    
    // Draw palette points
    drawPalettePointsOnWheel();
    
    // Handle clicks
    const handleColorWheelClick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Check if a palette point was clicked
        let pointClicked = false;
        for (const point of state.palettePointPositions) {
            const dx = x - point.x;
            const dy = y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= 10) {
                e.preventDefault();
                e.stopPropagation();
                highlightAndScrollToPaletteItem(point.colorIndex);
                pointClicked = true;
                return;
            }
        }
        
        // Handle regular color wheel click
        if (!pointClicked) {
            const dx = x - state.colorWheelCenterX;
            const dy = y - state.colorWheelCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= state.colorWheelRadius) {
                const pixel = colorWheelCtx.getImageData(x, y, 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                const hex = rgbToHex(r, g, b);
                
                updateColorWheelPreview(r, g, b, hex);
                
                if (displayCurrentColor) {
                    state.currentColor = { r, g, b, hex };
                    displayCurrentColor();
                }
            }
        }
    };
    
    canvas.addEventListener('click', handleColorWheelClick);
    
    // Magnifying glass
    const magnifyingGlass = document.getElementById('magnifyingGlass');
    const magnifyingCanvas = document.getElementById('magnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    if (wrapper && wrapper.closest('.floating-color-wheel')) {
        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.floating-wheel-header')) {
                return;
            }
            if (e.target === magnifyingGlass || e.target === magnifyingCanvas || 
                (magnifyingGlass && magnifyingGlass.contains(e.target))) {
                handleColorWheelClick(e);
            }
        }, false);
    }
    
    if (magnifyingCanvas) {
        magnifyingCanvas.width = 120;
        magnifyingCanvas.height = 120;
    }
    
    let animationFrameId = null;
    let lastUpdateTime = 0;
    const throttleDelay = 16;
    
    const updateMagnifyingGlass = (e) => {
        const now = performance.now();
        if (now - lastUpdateTime < throttleDelay) {
            return;
        }
        lastUpdateTime = now;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        animationFrameId = requestAnimationFrame(() => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);
            
            // Check if hovering over a palette point
            let hoveringOverPoint = false;
            for (const point of state.palettePointPositions) {
                const dx = x - point.x;
                const dy = y - point.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= point.radius) {
                    hoveringOverPoint = true;
                    canvas.style.cursor = 'pointer';
                    break;
                }
            }
            
            if (!hoveringOverPoint) {
                canvas.style.cursor = 'crosshair';
            }
            
            const dx = x - state.colorWheelCenterX;
            const dy = y - state.colorWheelCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= state.colorWheelRadius) {
                const pixel = colorWheelCtx.getImageData(x, y, 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                const hex = rgbToHex(r, g, b);
                updateColorWheelPreview(r, g, b, hex);
                
                if (magnifyingGlass && magnifyingCanvas) {
                    const wrapperRect = wrapper.getBoundingClientRect();
                    const glassSize = 120;
                    const glassX = e.clientX - wrapperRect.left - glassSize / 2;
                    const glassY = e.clientY - wrapperRect.top - glassSize / 2;
                    
                    magnifyingGlass.style.display = 'block';
                    magnifyingGlass.style.left = glassX + 'px';
                    magnifyingGlass.style.top = glassY + 'px';
                    
                    const zoom = 2;
                    const sourceSize = glassSize / zoom;
                    const sourceX = x - sourceSize / 2;
                    const sourceY = y - sourceSize / 2;
                    
                    const magCtx = magnifyingCanvas.getContext('2d');
                    
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
                    
                    magCtx.restore();
                }
            } else {
                if (magnifyingGlass) {
                    magnifyingGlass.style.display = 'none';
                }
                canvas.style.cursor = 'default';
            }
        });
    };
    
    canvas.addEventListener('mousemove', updateMagnifyingGlass);
    
    canvas.addEventListener('mouseleave', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        if (magnifyingGlass) {
            magnifyingGlass.style.display = 'none';
        }
    });
}

// Initialize collection color wheel
export function initCollectionWheel() {
    const canvas = document.getElementById('collectionWheelCanvas');
    if (!canvas) return;
    
    collectionWheelCanvas = canvas;
    collectionWheelCtx = canvas.getContext('2d');
    state.collectionWheelCanvas = canvas;
    state.collectionWheelCtx = collectionWheelCtx;
    
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    
    state.collectionWheelCenterX = size / 2;
    state.collectionWheelCenterY = size / 2;
    state.collectionWheelRadius = size / 2 - 10;
    
    // Draw color wheel base
    drawCollectionWheelBase();
    
    // Draw collection points
    drawCollectionPointsOnWheel();
    
    // Handle clicks
    const handleCollectionWheelClick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Check if a collection point was clicked
        for (const point of state.collectionPointPositions) {
            const dx = x - point.x;
            const dy = y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= 10) {
                e.preventDefault();
                e.stopPropagation();
                highlightAndScrollToCollectionItem(point.colorIndex);
                return;
            }
        }
    };
    
    canvas.addEventListener('click', handleCollectionWheelClick);
    
    // Magnifying glass
    const magnifyingGlass = document.getElementById('collectionMagnifyingGlass');
    const magnifyingCanvas = document.getElementById('collectionMagnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    if (wrapper && wrapper.closest('.floating-color-wheel')) {
        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.floating-wheel-header')) {
                return;
            }
            if (e.target === magnifyingGlass || e.target === magnifyingCanvas || 
                (magnifyingGlass && magnifyingGlass.contains(e.target))) {
                handleCollectionWheelClick(e);
            }
        }, false);
    }
    
    if (magnifyingCanvas) {
        magnifyingCanvas.width = 120;
        magnifyingCanvas.height = 120;
    }
    
    let animationFrameId = null;
    let lastUpdateTime = 0;
    const throttleDelay = 16;
    
    wrapper.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastUpdateTime < throttleDelay) {
            return;
        }
        lastUpdateTime = now;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        animationFrameId = requestAnimationFrame(() => {
            updateCollectionMagnifyingGlass(e, wrapper, canvas, magnifyingGlass, magnifyingCanvas);
        });
    });
    
    wrapper.addEventListener('mouseleave', () => {
        if (magnifyingGlass) {
            magnifyingGlass.style.display = 'none';
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    });
}

// Initialize floating color wheel
export function initFloatingWheel() {
    const floatingWheel = document.getElementById('floatingColorWheel');
    const showWheelBtn = document.getElementById('showWheelBtn');
    const closeWheelBtn = document.getElementById('closeWheelBtn');
    
    if (!floatingWheel || !showWheelBtn || !closeWheelBtn) return;
    
    const wheelHeader = floatingWheel.querySelector('.floating-wheel-header');
    if (!wheelHeader) return;
    
    // Show wheel button
    showWheelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        floatingWheel.style.display = 'block';
    });
    
    // Close wheel button
    closeWheelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        floatingWheel.style.display = 'none';
        return false;
    });
    
    closeWheelBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    
    // Drag functionality
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;
    
    const rect = floatingWheel.getBoundingClientRect();
    xOffset = rect.left;
    yOffset = rect.top;
    
    // Load saved position
    const savedPosition = localStorage.getItem('colorWheelPosition');
    if (savedPosition) {
        try {
            const pos = JSON.parse(savedPosition);
            if (pos.x !== undefined && pos.y !== undefined) {
                xOffset = pos.x;
                yOffset = pos.y;
                floatingWheel.style.left = xOffset + 'px';
                floatingWheel.style.top = yOffset + 'px';
            }
        } catch (e) {
            console.error('Error loading saved position:', e);
        }
    }
    
    // Make header draggable
    wheelHeader.addEventListener('mousedown', (e) => {
        if (e.target === closeWheelBtn || e.target.closest('.close-wheel-btn')) {
            return;
        }
        
        const currentRect = floatingWheel.getBoundingClientRect();
        xOffset = currentRect.left;
        yOffset = currentRect.top;
        
        isDragging = true;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        floatingWheel.style.zIndex = '10001';
        
        return false;
    }, true);
    
    const handleMouseMove = (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            xOffset = currentX;
            yOffset = currentY;
            
            floatingWheel.style.left = xOffset + 'px';
            floatingWheel.style.top = yOffset + 'px';
        }
    };
    
    const handleMouseUp = (e) => {
        if (isDragging) {
            try {
                localStorage.setItem('colorWheelPosition', JSON.stringify({
                    x: xOffset,
                    y: yOffset
                }));
            } catch (e) {
                console.error('Error saving position:', e);
            }
            isDragging = false;
            floatingWheel.style.zIndex = '10000';
        }
    };
    
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    
    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            floatingWheel.style.zIndex = '10000';
        }
    });
}

// Initialize collection floating wheel
export function initCollectionFloatingWheel() {
    const floatingWheel = document.getElementById('floatingCollectionWheel');
    const showWheelBtn = document.getElementById('showCollectionWheelBtn');
    const closeWheelBtn = document.getElementById('closeCollectionWheelBtn');
    
    if (!floatingWheel || !showWheelBtn || !closeWheelBtn) return;
    
    const wheelHeader = floatingWheel.querySelector('.floating-wheel-header');
    if (!wheelHeader) return;
    
    // Hide wheel by default
    floatingWheel.style.display = 'none';
    
    // Show wheel button
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'showCollectionWheelBtn') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (floatingWheel) {
                floatingWheel.style.display = 'block';
            }
            return false;
        }
    }, true);
    
    showWheelBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (floatingWheel) {
            floatingWheel.style.display = 'block';
        }
        return false;
    }, true);
    
    // Close wheel button
    closeWheelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        floatingWheel.style.display = 'none';
        return false;
    });
    
    closeWheelBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    
    // Drag functionality
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;
    
    const wheelWidth = 450;
    const defaultX = window.innerWidth - wheelWidth - 20;
    const defaultY = 100;
    
    xOffset = defaultX;
    yOffset = defaultY;
    
    // Load saved position
    const savedPosition = localStorage.getItem('collectionWheelPosition');
    if (savedPosition) {
        try {
            const pos = JSON.parse(savedPosition);
            if (pos.x !== undefined && pos.y !== undefined) {
                const maxX = window.innerWidth - wheelWidth;
                const maxY = window.innerHeight - 400;
                
                if (pos.x >= 0 && pos.x <= maxX && pos.y >= 0 && pos.y <= maxY) {
                    xOffset = pos.x;
                    yOffset = pos.y;
                } else {
                    xOffset = defaultX;
                    yOffset = defaultY;
                }
                floatingWheel.style.left = xOffset + 'px';
                floatingWheel.style.top = yOffset + 'px';
            }
        } catch (e) {
            console.error('Error loading saved collection wheel position:', e);
            xOffset = defaultX;
            yOffset = defaultY;
            floatingWheel.style.left = xOffset + 'px';
            floatingWheel.style.top = yOffset + 'px';
        }
    } else {
        floatingWheel.style.left = xOffset + 'px';
        floatingWheel.style.top = yOffset + 'px';
    }
    
    // Make header draggable
    wheelHeader.addEventListener('mousedown', (e) => {
        if (e.target === closeWheelBtn || e.target.closest('.close-wheel-btn')) {
            return;
        }
        
        const currentRect = floatingWheel.getBoundingClientRect();
        xOffset = currentRect.left;
        yOffset = currentRect.top;
        
        isDragging = true;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        floatingWheel.style.zIndex = '10001';
        
        return false;
    }, true);
    
    const handleMouseMove = (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            xOffset = currentX;
            yOffset = currentY;
            
            floatingWheel.style.left = xOffset + 'px';
            floatingWheel.style.top = yOffset + 'px';
        }
    };
    
    const handleMouseUp = (e) => {
        if (isDragging) {
            try {
                localStorage.setItem('collectionWheelPosition', JSON.stringify({
                    x: xOffset,
                    y: yOffset
                }));
            } catch (e) {
                console.error('Error saving collection wheel position:', e);
            }
            isDragging = false;
            floatingWheel.style.zIndex = '10000';
        }
    };
    
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    
    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            floatingWheel.style.zIndex = '10000';
        }
    });
}

// Initialize color wheel sliders
export function initColorWheelSliders() {
    // Palette wheel sliders
    const paletteValueSlider = document.getElementById('paletteValueSlider');
    const paletteValueDisplay = document.getElementById('paletteValueDisplay');
    const paletteRangeSlider = document.getElementById('paletteRangeSlider');
    const paletteRangeDisplay = document.getElementById('paletteRangeDisplay');
    
    if (paletteValueSlider && paletteValueDisplay && paletteRangeSlider && paletteRangeDisplay) {
        paletteValueSlider.value = state.paletteValueMiddle;
        paletteValueDisplay.textContent = Math.round(state.paletteValueMiddle);
        paletteRangeSlider.value = state.paletteValueRange;
        paletteRangeDisplay.textContent = Math.round(state.paletteValueRange);
        
        paletteValueSlider.addEventListener('input', (e) => {
            state.paletteValueMiddle = parseFloat(e.target.value);
            paletteValueDisplay.textContent = Math.round(state.paletteValueMiddle);
            savePaletteValueMiddle(state.paletteValueMiddle);
            drawPalettePointsOnWheel();
        });
        
        paletteRangeSlider.addEventListener('input', (e) => {
            state.paletteValueRange = parseFloat(e.target.value);
            paletteRangeDisplay.textContent = Math.round(state.paletteValueRange);
            savePaletteValueRange(state.paletteValueRange);
            drawPalettePointsOnWheel();
        });
    }
    
    // Collection wheel sliders
    const collectionValueSlider = document.getElementById('collectionValueSlider');
    const collectionValueDisplay = document.getElementById('collectionValueDisplay');
    const collectionRangeSlider = document.getElementById('collectionRangeSlider');
    const collectionRangeDisplay = document.getElementById('collectionRangeDisplay');
    
    if (collectionValueSlider && collectionValueDisplay && collectionRangeSlider && collectionRangeDisplay) {
        collectionValueSlider.value = state.collectionValueMiddle;
        collectionValueDisplay.textContent = Math.round(state.collectionValueMiddle);
        collectionRangeSlider.value = state.collectionValueRange;
        collectionRangeDisplay.textContent = Math.round(state.collectionValueRange);
        
        collectionValueSlider.addEventListener('input', (e) => {
            state.collectionValueMiddle = parseFloat(e.target.value);
            collectionValueDisplay.textContent = Math.round(state.collectionValueMiddle);
            saveCollectionValueMiddle(state.collectionValueMiddle);
            drawCollectionPointsOnWheel();
        });
        
        collectionRangeSlider.addEventListener('input', (e) => {
            state.collectionValueRange = parseFloat(e.target.value);
            collectionRangeDisplay.textContent = Math.round(state.collectionValueRange);
            saveCollectionValueRange(state.collectionValueRange);
            drawCollectionPointsOnWheel();
        });
    }
}

// Initialize selected color filter toggle
export function initSelectedColorFilterToggle() {
    const filterBtn = document.getElementById('selectedColorFilterBtn');
    const filterContainer = document.getElementById('selectedColorFilters');
    
    if (filterBtn && filterContainer) {
        filterBtn.addEventListener('click', () => {
            const isVisible = filterContainer.style.display !== 'none';
            filterContainer.style.display = isVisible ? 'none' : 'block';
            filterBtn.classList.toggle('active', !isVisible);
        });
    }
}

