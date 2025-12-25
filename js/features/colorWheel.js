/**
 * Color Wheel feature - handles color wheel rendering, interactions, and floating wheels
 * Refactored to eliminate code duplication using class-based approach
 */

import { rgbToHex, rgbToHSV, hsvToRGB, hexToRgb } from '../utils/colorUtils.js';
import { state, getPalette, getMyCollection, getMergedPaintColors, getShoppingCart } from '../core/state.js';
import { getEffectiveMyCollection } from './myCollection.js';
import { savePaletteValueMiddle, savePaletteValueRange, saveCollectionValueMiddle, saveCollectionValueRange } from '../utils/storage.js';
import { filterData } from './filters.js';

// Dependencies
let displayCurrentColor = null;
let updateColorWheelPreview = null;

// ============================================================================
// PHASE 1: COMMON UTILITY CLASSES
// ============================================================================

/**
 * Base ColorWheel class - handles all common wheel rendering and interaction logic
 */
class ColorWheel {
    constructor(config) {
        this.canvas = config.canvas;
        this.ctx = config.ctx;
        this.size = config.size || 400;
        this.centerX = this.size / 2;
        this.centerY = this.size / 2;
        this.radius = this.size / 2 - 10;
        this.pointPositions = [];
        this.valueMiddle = config.valueMiddle || 50;
        this.valueRange = config.valueRange || 100;
        this.type = config.type; // 'palette', 'collection', 'paintColors', 'colorSelect'
        
        // Initialize canvas
        this.canvas.width = this.size;
        this.canvas.height = this.size;
    }
    
    /**
     * Draw the base HSV color wheel
     */
    drawBase() {
        this.ctx.clearRect(0, 0, this.size, this.size);
        
        // Use ImageData for better performance
        const imageData = this.ctx.createImageData(this.size, this.size);
        const data = imageData.data;
        
        // Draw color wheel
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const dx = x - this.centerX;
                const dy = y - this.centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= this.radius) {
                    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                    const saturation = Math.min(distance / this.radius, 1);
                    const value = 1;
                    
                    const rgb = hsvToRGB(angle, saturation, value);
                    
                    const index = (y * this.size + x) * 4;
                    data[index] = rgb.r;
                    data[index + 1] = rgb.g;
                    data[index + 2] = rgb.b;
                    data[index + 3] = 255;
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // Add white center gradient for saturation
        const gradient = this.ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, this.radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.globalCompositeOperation = 'multiply';
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Add black outer ring
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    
    /**
     * Draw color points on the wheel
     */
    drawPoints(colors, filterConfig = null) {
        // Redraw base first
        this.drawBase();
        
        // Clear previous point positions
        this.pointPositions = [];
        
        if (!colors || colors.length === 0) return;
        
        // Apply filters if configured
        let filteredColors = colors;
        if (filterConfig && filterConfig.filterContainerId && filterData) {
            filteredColors = filterData(colors, filterConfig.filterContainerId);
        }
        
        // Limit to 1000 points maximum
        const MAX_POINTS = 1000;
        if (filteredColors.length > MAX_POINTS) {
            filteredColors = filteredColors.slice(0, MAX_POINTS);
        }
        
        // Calculate Value range
        const valueMin = this.valueMiddle - (this.valueRange / 2);
        const valueMax = this.valueMiddle + (this.valueRange / 2);
        
        // Draw each color as a point
        filteredColors.forEach((color, index) => {
            // Get RGB values
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
            
            // Convert Value from 0-1 to 0-100 for comparison
            const valuePercent = hsv.v * 100;
            
            // Filter by Value range
            if (valuePercent < valueMin || valuePercent > valueMax) {
                return;
            }
            
            // Calculate position on color wheel
            const angle = (hsv.h * Math.PI) / 180;
            const distance = hsv.s * this.radius;
            
            const x = this.centerX + distance * Math.cos(angle);
            const y = this.centerY + distance * Math.sin(angle);
            
            // Store point position for click detection
            this.pointPositions.push({
                x: x,
                y: y,
                radius: 7,
                colorIndex: index,
                color: color,
                originalIndex: filterConfig ? filterConfig.getOriginalIndex?.(color, index) : index
            });
            
            // Draw the color as a filled circle
            this.ctx.fillStyle = color.hex;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Draw white outline
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
            this.ctx.stroke();
            
            // Draw black outline
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
            this.ctx.stroke();
        });
    }
    
    /**
     * Handle click on the wheel
     */
    handleClick(e, onPointClick, onWheelClick = null) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Check if a point was clicked
        for (const point of this.pointPositions) {
            const dx = x - point.x;
            const dy = y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= 10) {
                e.preventDefault();
                e.stopPropagation();
                if (onPointClick) {
                    onPointClick(point);
                }
                return true;
            }
        }
        
        // Handle regular wheel click if callback provided
        if (onWheelClick) {
            const dx = x - this.centerX;
            const dy = y - this.centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= this.radius) {
                const pixel = this.ctx.getImageData(x, y, 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                const hex = rgbToHex(r, g, b);
                onWheelClick({ r, g, b, hex });
            }
        }
        
        return false;
    }
    
    /**
     * Setup magnifying glass functionality
     */
    setupMagnifyingGlass(magnifyingGlass, magnifyingCanvas, wrapper) {
        if (!magnifyingGlass || !magnifyingCanvas) return;
        
        const magCtx = magnifyingCanvas.getContext('2d');
        magnifyingCanvas.width = 120;
        magnifyingCanvas.height = 120;
        
        // Get tooltip element for paint color wheels and collection wheel
        // Look up tooltip dynamically each time to ensure it exists
        const getTooltip = () => {
            if (this.type === 'paintColors') {
                return document.getElementById('paintColorsWheelTooltip');
            } else if (this.type === 'colorSelect') {
                return document.getElementById('colorSelectWheelTooltip');
            } else if (this.type === 'collection') {
                return document.getElementById('collectionWheelTooltip');
            }
            return null;
        };
        
        let animationFrameId = null;
        let lastUpdateTime = 0;
        const throttleDelay = 16;
        
        const updateMagnifyingGlass = (e) => {
            const now = performance.now();
            if (now - lastUpdateTime < throttleDelay) return;
            lastUpdateTime = now;
            
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            animationFrameId = requestAnimationFrame(() => {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const x = Math.floor((e.clientX - rect.left) * scaleX);
                const y = Math.floor((e.clientY - rect.top) * scaleY);
                
                // Check if hovering over a point and get the point data
                let hoveredPoint = null;
                for (const point of this.pointPositions) {
                    const dx = x - point.x;
                    const dy = y - point.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= point.radius) {
                        hoveredPoint = point;
                        this.canvas.style.cursor = 'pointer';
                        break;
                    }
                }
                
                if (!hoveredPoint) {
                    this.canvas.style.cursor = this.type === 'palette' ? 'crosshair' : 'default';
                    // Hide tooltip if not hovering over a paint point
                    const tooltip = getTooltip();
                    if (tooltip) {
                        tooltip.style.display = 'none';
                    }
                }
                
                const dx = x - this.centerX;
                const dy = y - this.centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= this.radius) {
                    const wrapperRect = wrapper.getBoundingClientRect();
                    const glassSize = 120;
                    const glassX = e.clientX - wrapperRect.left - glassSize / 2;
                    const glassY = e.clientY - wrapperRect.top - glassSize / 2;
                    
                    magnifyingGlass.style.display = 'block';
                    magnifyingGlass.style.left = glassX + 'px';
                    magnifyingGlass.style.top = glassY + 'px';
                    
                    // Show tooltip for paint colors above magnifying glass
                    const tooltip = getTooltip();
                    if (tooltip && hoveredPoint && hoveredPoint.color) {
                        const color = hoveredPoint.color;
                        const tooltipOffset = 10; // Gap between tooltip and magnifying glass
                        
                        // Check if paint is in My Collection or Shopping Cart
                        const myCollection = getMyCollection();
                        const shoppingCart = getShoppingCart();
                        const inMyCollection = myCollection.some(c => 
                            c.hex === color.hex && 
                            c.name === color.name && 
                            c.producer === color.producer
                        );
                        const inShoppingCart = shoppingCart.some(c => 
                            c.hex === color.hex && 
                            c.name === color.name && 
                            c.producer === color.producer
                        );
                        
                        // Determine icon based on status
                        let iconHTML = '';
                        if (inMyCollection) {
                            iconHTML = '<div class="tooltip-status-icon tooltip-check-icon">✓</div>';
                        } else if (inShoppingCart) {
                            iconHTML = '<div class="tooltip-status-icon tooltip-shopping-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></div>';
                        } else {
                            iconHTML = '<div class="tooltip-status-icon tooltip-question-icon">?</div>';
                        }
                        
                        // Build tooltip content
                        let tooltipHTML = `<div class="tooltip-header">${iconHTML}<div class="tooltip-name">${color.name || ''}</div></div>`;
                        
                        if (color.type && Array.isArray(color.type) && color.type.length > 0) {
                            tooltipHTML += `<div class="tooltip-type">${color.type.join(', ')}</div>`;
                        }
                        
                        if (color.producer) {
                            tooltipHTML += `<div class="tooltip-producer">${color.producer}</div>`;
                        }
                        
                        tooltip.innerHTML = tooltipHTML;
                        
                        // Force a reflow to ensure tooltip is rendered before getting height
                        tooltip.style.display = 'block';
                        void tooltip.offsetHeight; // Force reflow
                        
                        // Position tooltip above magnifying glass, centered horizontally
                        const tooltipHeight = tooltip.offsetHeight || 80;
                        const tooltipX = glassX + glassSize / 2;
                        const tooltipY = glassY - tooltipHeight - tooltipOffset;
                        
                        tooltip.style.left = tooltipX + 'px';
                        tooltip.style.top = tooltipY + 'px';
                        tooltip.style.transform = 'translateX(-50%)';
                        tooltip.style.visibility = 'visible';
                        tooltip.style.opacity = '1';
                    } else if (tooltip) {
                        tooltip.style.display = 'none';
                    }
                    
                    const zoom = 2;
                    const sourceSize = glassSize / zoom;
                    const sourceX = x - sourceSize / 2;
                    const sourceY = y - sourceSize / 2;
                    
                    magCtx.clearRect(0, 0, glassSize, glassSize);
                    magCtx.save();
                    magCtx.beginPath();
                    magCtx.arc(glassSize / 2, glassSize / 2, glassSize / 2, 0, 2 * Math.PI);
                    magCtx.clip();
                    
                    magCtx.drawImage(
                        this.canvas,
                        sourceX, sourceY, sourceSize, sourceSize,
                        0, 0, glassSize, glassSize
                    );
                    
                    magCtx.restore();
                    
                    // Update color preview if available (palette wheel only)
                    if (this.type === 'palette' && updateColorWheelPreview) {
                        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
                        const r = pixel[0];
                        const g = pixel[1];
                        const b = pixel[2];
                        const hex = rgbToHex(r, g, b);
                        updateColorWheelPreview(r, g, b, hex);
                    }
                } else {
                    magnifyingGlass.style.display = 'none';
                    this.canvas.style.cursor = 'default';
                    // Hide tooltip when outside wheel
                    const tooltip = getTooltip();
                    if (tooltip) {
                        tooltip.style.display = 'none';
                    }
                }
            });
        };
        
        this.canvas.addEventListener('mousemove', updateMagnifyingGlass);
        
        this.canvas.addEventListener('mouseleave', () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            magnifyingGlass.style.display = 'none';
            // Hide tooltip when mouse leaves canvas
            const tooltip = getTooltip();
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        });
    }
}

/**
 * FloatingWheel class - handles floating wheel UI (dragging, positioning, sliders)
 */
class FloatingWheel {
    constructor(config) {
        this.container = config.container;
        this.showBtn = config.showBtn;
        this.closeBtn = config.closeBtn;
        this.positionStorageKey = config.positionStorageKey;
        this.defaultPosition = config.defaultPosition || { x: 100, y: 100 };
        this.wheelHeader = this.container?.querySelector('.floating-wheel-header');
        
        this.isDragging = false;
        this.currentX = 0;
        this.currentY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.xOffset = 0;
        this.yOffset = 0;
        
        if (this.container && this.showBtn && this.closeBtn) {
            this.initShowHide();
            this.initDragging();
            this.loadPosition();
            this.updateButtonText();
        }
    }
    
    updateButtonText() {
        if (!this.showBtn || !this.container) return;
        const isVisible = this.container.style.display !== 'none' && 
                         window.getComputedStyle(this.container).display !== 'none';
        // Update title attribute for accessibility
        this.showBtn.title = isVisible ? 'Hide Color Wheel' : 'Show Color Wheel';
        // Update text span
        const textSpan = this.showBtn.querySelector('.show-wheel-btn-text');
        if (textSpan) {
            textSpan.textContent = isVisible ? 'Hide' : 'Show';
        }
    }
    
    showWheel() {
        if (!this.container) return;
        // Always show at default position when clicking Show Wheel
        this.xOffset = this.defaultPosition.x;
        this.yOffset = this.defaultPosition.y;
        this.container.style.left = this.xOffset + 'px';
        this.container.style.top = this.yOffset + 'px';
        this.container.style.display = 'block';
        this.updateButtonText();
    }
    
    hideWheel() {
        if (!this.container) return;
        this.container.style.display = 'none';
        this.updateButtonText();
    }
    
    initShowHide() {
        // Show/Hide button toggle
        this.showBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const isVisible = this.container.style.display !== 'none' && 
                             window.getComputedStyle(this.container).display !== 'none';
            if (isVisible) {
                this.hideWheel();
            } else {
                this.showWheel();
            }
            return false;
        }, true);
        
        // Close button
        this.closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.hideWheel();
            return false;
        });
        
        this.closeBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
        });
    }
    
    initDragging() {
        if (!this.wheelHeader) return;
        
        this.wheelHeader.addEventListener('mousedown', (e) => {
            if (e.target === this.closeBtn || e.target.closest('.close-wheel-btn')) {
                return;
            }
            
            const currentRect = this.container.getBoundingClientRect();
            this.xOffset = currentRect.left;
            this.yOffset = currentRect.top;
            
            this.isDragging = true;
            this.initialX = e.clientX - this.xOffset;
            this.initialY = e.clientY - this.yOffset;
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            this.container.style.zIndex = '10001';
            
            return false;
        }, true);
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                this.currentX = e.clientX - this.initialX;
                this.currentY = e.clientY - this.initialY;
                
                this.xOffset = this.currentX;
                this.yOffset = this.currentY;
                
                this.container.style.left = this.xOffset + 'px';
                this.container.style.top = this.yOffset + 'px';
            }
        }, true);
        
        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.savePosition();
                this.isDragging = false;
                this.container.style.zIndex = '10000';
            }
        }, true);
        
        document.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container.style.zIndex = '10000';
            }
        });
    }
    
    loadPosition() {
        // Initialize offsets to default (wheel starts hidden, position set when shown)
        this.xOffset = this.defaultPosition.x;
        this.yOffset = this.defaultPosition.y;
    }
    
    savePosition() {
        try {
            localStorage.setItem(this.positionStorageKey, JSON.stringify({
                x: this.xOffset,
                y: this.yOffset
            }));
        } catch (e) {
            // Position saving failed
        }
    }
    
    /**
     * Initialize sliders for Value and Range
     */
    initSliders(config) {
        const valueSlider = document.getElementById(config.valueSliderId);
        const valueDisplay = document.getElementById(config.valueDisplayId);
        const rangeSlider = document.getElementById(config.rangeSliderId);
        const rangeDisplay = document.getElementById(config.rangeDisplayId);
        
        if (valueSlider && valueDisplay && rangeSlider && rangeDisplay) {
            valueSlider.value = config.valueMiddle;
            valueDisplay.textContent = Math.round(config.valueMiddle);
            rangeSlider.value = config.valueRange;
            rangeDisplay.textContent = Math.round(config.valueRange);
            
            valueSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                valueDisplay.textContent = Math.round(value);
                if (config.onValueChange) {
                    config.onValueChange(value);
                }
            });
            
            rangeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                rangeDisplay.textContent = Math.round(value);
                if (config.onRangeChange) {
                    config.onRangeChange(value);
                }
            });
        }
    }
}

/**
 * Generic function to highlight and scroll to item in table/list
 */
function highlightAndScrollToItem(selector, matchFn, timeout = 3000) {
    const elements = document.querySelectorAll(selector);
    
    // Remove previous highlights (both class and inline style)
    elements.forEach(el => {
        el.classList.remove('highlighted');
        if (el.style.backgroundColor === 'rgb(227, 242, 253)' || el.style.backgroundColor === '#e3f2fd') {
            el.style.backgroundColor = '';
        }
    });
    
    // Find and highlight matching element
    for (const el of elements) {
        if (matchFn(el)) {
            el.classList.add('highlighted');
            el.style.backgroundColor = '#e3f2fd'; // Light blue
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                el.classList.remove('highlighted');
                el.style.backgroundColor = '';
            }, timeout);
            break;
        }
    }
}

// ============================================================================
// PHASE 2: REFACTORED WHEEL IMPLEMENTATIONS
// ============================================================================

// Wheel instances
let paletteWheel = null;
let collectionWheel = null;
let paintColorsWheel = null;
let colorSelectWheel = null;

// Canvas references (for backward compatibility)
let colorWheelCanvas = null;
let colorWheelCtx = null;
let collectionWheelCanvas = null;
let collectionWheelCtx = null;
let paintColorsWheelCanvas = null;
let paintColorsWheelCtx = null;

/**
 * Update color wheel preview (for palette wheel)
 */
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

/**
 * Initialize palette color wheel
 */
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
    
    // Create wheel instance
    paletteWheel = new ColorWheel({
        canvas: canvas,
        ctx: colorWheelCtx,
        size: 400,
        valueMiddle: state.paletteValueMiddle,
        valueRange: state.paletteValueRange,
        type: 'palette'
    });
    
    // Store in state for backward compatibility
    state.colorWheelCanvas = canvas;
    state.colorWheelCtx = colorWheelCtx;
    state.colorWheelCenterX = paletteWheel.centerX;
    state.colorWheelCenterY = paletteWheel.centerY;
    state.colorWheelRadius = paletteWheel.radius;
    
    // Draw initial wheel
    drawPalettePointsOnWheel();
    
    // Handle clicks
    canvas.addEventListener('click', (e) => {
        const pointClicked = paletteWheel.handleClick(
            e,
            (point) => {
                highlightAndScrollToPaletteItem(point.colorIndex);
            },
            (color) => {
                updateColorWheelPreview(color.r, color.g, color.b, color.hex);
                if (displayCurrentColor) {
                    state.currentColor = color;
                    displayCurrentColor();
                }
            }
        );
    });
    
    // Setup magnifying glass
    const magnifyingGlass = document.getElementById('magnifyingGlass');
    const magnifyingCanvas = document.getElementById('magnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    if (wrapper) {
        paletteWheel.setupMagnifyingGlass(magnifyingGlass, magnifyingCanvas, wrapper);
    }
}

/**
 * Draw palette points on wheel
 */
export function drawPalettePointsOnWheel() {
    if (!paletteWheel) return;
    
    paletteWheel.valueMiddle = state.paletteValueMiddle;
    paletteWheel.valueRange = state.paletteValueRange;
    paletteWheel.drawPoints(getPalette());
    
    // Store in state for backward compatibility
    state.palettePointPositions = paletteWheel.pointPositions;
}

/**
 * Highlight and scroll to palette item
 */
export function highlightAndScrollToPaletteItem(index) {
    highlightAndScrollToItem('.palette-item', (el) => {
        return Array.from(document.querySelectorAll('.palette-item')).indexOf(el) === index;
    });
}

/**
 * Initialize collection color wheel
 */
export function initCollectionWheel() {
    const canvas = document.getElementById('collectionWheelCanvas');
    if (!canvas) return;
    
    collectionWheelCanvas = canvas;
    collectionWheelCtx = canvas.getContext('2d');
    
    // Create wheel instance
    collectionWheel = new ColorWheel({
        canvas: canvas,
        ctx: collectionWheelCtx,
        size: 400,
        valueMiddle: state.collectionValueMiddle,
        valueRange: state.collectionValueRange,
        type: 'collection'
    });
    
    // Store in state
    state.collectionWheelCanvas = canvas;
    state.collectionWheelCtx = collectionWheelCtx;
    state.collectionWheelCenterX = collectionWheel.centerX;
    state.collectionWheelCenterY = collectionWheel.centerY;
    state.collectionWheelRadius = collectionWheel.radius;
    
    // Draw initial wheel
    drawCollectionPointsOnWheel();
    
    // Handle clicks
    canvas.addEventListener('click', (e) => {
        collectionWheel.handleClick(e, (point) => {
            highlightAndScrollToCollectionItem(point.originalIndex);
        });
    });
    
    // Setup magnifying glass
    const magnifyingGlass = document.getElementById('collectionMagnifyingGlass');
    const magnifyingCanvas = document.getElementById('collectionMagnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    if (wrapper) {
        collectionWheel.setupMagnifyingGlass(magnifyingGlass, magnifyingCanvas, wrapper);
    }
}

/**
 * Draw collection points on wheel
 */
export function drawCollectionPointsOnWheel() {
    if (!collectionWheel) return;
    
    const myCollection = getEffectiveMyCollection();
    
    collectionWheel.valueMiddle = state.collectionValueMiddle;
    collectionWheel.valueRange = state.collectionValueRange;
    collectionWheel.drawPoints(myCollection, {
        filterContainerId: 'myCollectionFilters',
        getOriginalIndex: (color, filteredIndex) => {
            return myCollection.findIndex(origItem => 
                origItem.hex === color.hex && 
                origItem.name === color.name &&
                origItem.producer === color.producer
            );
        }
    });
    
    // Store in state
    state.collectionPointPositions = collectionWheel.pointPositions;
}

/**
 * Highlight and scroll to collection item
 */
export function highlightAndScrollToCollectionItem(index) {
    const table = document.getElementById('myCollectionTable');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const myCollection = getEffectiveMyCollection();
    if (index < 0 || index >= myCollection.length) return;
    const targetColor = myCollection[index];
    
    highlightAndScrollToItem('#myCollectionTable tbody tr', (row) => {
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
            
            return (rowHex === targetRgbString || rowHex === targetHex) && 
                   rowName === targetColor.name && 
                   rowProducer === targetColor.producer;
        }
        return false;
    });
}

/**
 * Initialize paint colors wheel
 */
export function initPaintColorsWheel() {
    const canvas = document.getElementById('paintColorsWheelCanvas');
    if (!canvas) return;
    
    paintColorsWheelCanvas = canvas;
    paintColorsWheelCtx = canvas.getContext('2d');
    
    // Create wheel instance
    paintColorsWheel = new ColorWheel({
        canvas: canvas,
        ctx: paintColorsWheelCtx,
        size: 400,
        valueMiddle: state.paintColorsValueMiddle,
        valueRange: state.paintColorsValueRange,
        type: 'paintColors'
    });
    
    // Store in state
    state.paintColorsWheelCanvas = canvas;
    state.paintColorsWheelCtx = paintColorsWheelCtx;
    state.paintColorsWheelCenterX = paintColorsWheel.centerX;
    state.paintColorsWheelCenterY = paintColorsWheel.centerY;
    state.paintColorsWheelRadius = paintColorsWheel.radius;
    
    // Draw initial wheel
    drawPaintColorsPointsOnWheel();
    
    // Handle clicks
    canvas.addEventListener('click', (e) => {
        paintColorsWheel.handleClick(e, (point) => {
            highlightAndScrollToPaintColorItem(point.colorIndex);
        });
    });
    
    // Setup magnifying glass
    const magnifyingGlass = document.getElementById('paintColorsMagnifyingGlass');
    const magnifyingCanvas = document.getElementById('paintColorsMagnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    if (wrapper) {
        paintColorsWheel.setupMagnifyingGlass(magnifyingGlass, magnifyingCanvas, wrapper);
    }
}

/**
 * Draw paint colors points on wheel
 */
export function drawPaintColorsPointsOnWheel() {
    if (!paintColorsWheel) return;
    
    paintColorsWheel.valueMiddle = state.paintColorsValueMiddle;
    paintColorsWheel.valueRange = state.paintColorsValueRange;
    paintColorsWheel.drawPoints(getMergedPaintColors(), {
        filterContainerId: 'paintColorsFilters'
    });
    
    // Store in state
    state.paintColorsPointPositions = paintColorsWheel.pointPositions;
}

/**
 * Highlight and scroll to paint color item
 */
export function highlightAndScrollToPaintColorItem(index) {
    const table = document.getElementById('paintColorsTable');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    highlightAndScrollToItem('#paintColorsTable tbody tr', (row) => {
        return Array.from(tbody.querySelectorAll('tr')).indexOf(row) === index;
    });
}

/**
 * Initialize color select wheel (for Custom Mix modal)
 */
export function initColorSelectFloatingWheel() {
    const canvas = document.getElementById('colorSelectWheelCanvas');
    const container = document.getElementById('floatingColorSelectWheel');
    if (!canvas || !container) return;
    
    // Hide by default (shown only when Select Color modal is open)
    container.style.display = 'none';
    
    const ctx = canvas.getContext('2d');
    
    // Create wheel instance
    colorSelectWheel = new ColorWheel({
        canvas: canvas,
        ctx: ctx,
        size: 400,
        valueMiddle: 50,
        valueRange: 100,
        type: 'colorSelect'
    });
    
    // Draw base wheel
    colorSelectWheel.drawBase();
    
    // Expose draw function globally
    window.drawColorSelectWheelPoints = function() {
        colorSelectWheel.drawPoints(getMergedPaintColors(), {
            filterContainerId: 'customMixColorSelectFilters'
        });
    };
    
    // Handle clicks
    canvas.addEventListener('click', (e) => {
        colorSelectWheel.handleClick(e, (point) => {
            scrollToAndHighlightColorInTable(point.color);
        });
    });
    
    // Setup magnifying glass
    const magnifyingGlass = document.getElementById('colorSelectMagnifyingGlass');
    const magnifyingCanvas = document.getElementById('colorSelectMagnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    if (wrapper) {
        colorSelectWheel.setupMagnifyingGlass(magnifyingGlass, magnifyingCanvas, wrapper);
    }
    
    // Initialize floating behavior
    const floatingWheel = new FloatingWheel({
        container: container,
        showBtn: null, // Controlled by mixing.js
        closeBtn: document.getElementById('closeColorSelectWheelBtn'),
        positionStorageKey: 'colorSelectWheelPosition',
        defaultPosition: { x: window.innerWidth - 470, y: 100 }
    });
    
    // Initialize sliders
    floatingWheel.initSliders({
        valueSliderId: 'colorSelectValueSlider',
        valueDisplayId: 'colorSelectValueDisplay',
        rangeSliderId: 'colorSelectRangeSlider',
        rangeDisplayId: 'colorSelectRangeDisplay',
        valueMiddle: colorSelectWheel.valueMiddle,
        valueRange: colorSelectWheel.valueRange,
        onValueChange: (value) => {
            colorSelectWheel.valueMiddle = value;
            window.drawColorSelectWheelPoints?.();
        },
        onRangeChange: (value) => {
            colorSelectWheel.valueRange = value;
            window.drawColorSelectWheelPoints?.();
        }
    });
}

/**
 * Scroll to color in table and highlight
 */
function scrollToAndHighlightColorInTable(color) {
    const table = document.getElementById('customMixColorSelectTable');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // Convert hex to RGB string for comparison
    const targetRgb = hexToRgb(color.hex);
    const targetRgbString = targetRgb ? `rgb(${targetRgb.r}, ${targetRgb.g}, ${targetRgb.b})` : color.hex;
    
    highlightAndScrollToItem('#customMixColorSelectTable tbody tr', (row) => {
        const colorBox = row.querySelector('.color-box');
        if (!colorBox) return false;
        
        const rowBgColor = colorBox.style.backgroundColor;
        // Compare both RGB string and hex formats
        return rowBgColor === targetRgbString || rowBgColor === color.hex;
    });
}

// ============================================================================
// PHASE 3: CONSOLIDATED FLOATING WHEELS AND SLIDERS
// ============================================================================

/**
 * Initialize floating palette wheel
 */
export function initFloatingWheel() {
    const floatingWheel = new FloatingWheel({
        container: document.getElementById('floatingColorWheel'),
        showBtn: document.getElementById('showWheelBtn'),
        closeBtn: document.getElementById('closeWheelBtn'),
        positionStorageKey: 'colorWheelPosition',
        defaultPosition: { x: 100, y: 100 }
    });
}

/**
 * Initialize floating collection wheel
 */
export function initCollectionFloatingWheel() {
    const container = document.getElementById('floatingCollectionWheel');
    
    // Hide by default
    if (container) {
        container.style.display = 'none';
    }
    
    const floatingWheel = new FloatingWheel({
        container: container,
        showBtn: document.getElementById('showCollectionWheelBtn'),
        closeBtn: document.getElementById('closeCollectionWheelBtn'),
        positionStorageKey: 'collectionWheelPosition',
        defaultPosition: { x: window.innerWidth - 470, y: 100 }
    });
}

/**
 * Initialize floating paint colors wheel
 */
export function initPaintColorsFloatingWheel() {
    const container = document.getElementById('floatingPaintColorsWheel');
    const showBtn = document.getElementById('showPaintColorsWheelBtn');
    const closeBtn = document.getElementById('closePaintColorsWheelBtn');
    
    if (!container || !showBtn || !closeBtn) return;
    
    // Hide by default
    container.style.display = 'none';
    
    const floatingWheel = new FloatingWheel({
        container: container,
        showBtn: showBtn,
        closeBtn: closeBtn,
        positionStorageKey: 'paintColorsWheelPosition',
        defaultPosition: { x: window.innerWidth - 470, y: 200 }
    });
    
    // Additional handler to redraw points when wheel is shown
    // Store reference to floatingWheel instance to access showWheel method
    const originalShowWheel = floatingWheel.showWheel.bind(floatingWheel);
    floatingWheel.showWheel = function() {
        originalShowWheel();
        // Redraw points when wheel is shown
        setTimeout(() => {
            drawPaintColorsPointsOnWheel();
        }, 10);
    };
    
    // Initialize sliders
    floatingWheel.initSliders({
        valueSliderId: 'paintColorsValueSlider',
        valueDisplayId: 'paintColorsValueDisplay',
        rangeSliderId: 'paintColorsRangeSlider',
        rangeDisplayId: 'paintColorsRangeDisplay',
        valueMiddle: state.paintColorsValueMiddle,
        valueRange: state.paintColorsValueRange,
        onValueChange: (value) => {
            state.paintColorsValueMiddle = value;
            localStorage.setItem('paintColorsValueMiddle', value.toString());
            drawPaintColorsPointsOnWheel();
        },
        onRangeChange: (value) => {
            state.paintColorsValueRange = value;
            localStorage.setItem('paintColorsValueRange', value.toString());
            drawPaintColorsPointsOnWheel();
        }
    });
}

/**
 * Initialize all color wheel sliders
 */
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

/**
 * Initialize selected color filter toggle
 */
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
