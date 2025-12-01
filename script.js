// DOM elements
const imageUpload = document.getElementById('imageUpload');
const imageSection = document.getElementById('imageSection');
const imageCanvas = document.getElementById('imageCanvas');
const cursorInfo = document.getElementById('cursorInfo');
const currentColorSection = document.getElementById('currentColorSection');
const colorPreview = document.getElementById('colorPreview');
const hexValue = document.getElementById('hexValue');
const rgbValue = document.getElementById('rgbValue');
const saveColorBtn = document.getElementById('saveColorBtn');
const paletteGrid = document.getElementById('paletteGrid');
const clearPaletteBtn = document.getElementById('clearPaletteBtn');
const copyButtons = document.querySelectorAll('.copy-btn');

// State
let currentColor = null;
let palette = JSON.parse(localStorage.getItem('colorPalette')) || [];
let ctx = imageCanvas.getContext('2d');
let colorWheelCanvas = null;
let colorWheelCtx = null;
let colorWheelCenterX = 0;
let colorWheelCenterY = 0;
let colorWheelRadius = 0;
let palettePointPositions = []; // Store positions of palette points on the wheel

// Initialize
loadPalette();
initColorWheel();
initTabs();
loadProducts();
loadPlanningTable();

// Initialize floating wheel - use setTimeout to ensure DOM is fully ready
setTimeout(() => {
    initFloatingWheel();
}, 0);

// Image upload handler
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
                imageSection.style.display = 'block';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Color picker on canvas click
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
    currentColor = { r, g, b, hex };
    displayCurrentColor();
});

// Show color info on mouse move
imageCanvas.addEventListener('mousemove', (e) => {
    const rect = imageCanvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    if (x >= 0 && x < imageCanvas.width && y >= 0 && y < imageCanvas.height) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];
        const hex = rgbToHex(r, g, b);
        
        cursorInfo.textContent = `X: ${x}, Y: ${y} | ${hex}`;
        cursorInfo.style.display = 'block';
        cursorInfo.style.left = `${e.clientX - rect.left + 10}px`;
        cursorInfo.style.top = `${e.clientY - rect.top + 10}px`;
    }
});

imageCanvas.addEventListener('mouseleave', () => {
    cursorInfo.style.display = 'none';
});

// Display current color
function displayCurrentColor() {
    if (!currentColor) return;
    
    colorPreview.style.backgroundColor = currentColor.hex;
    hexValue.value = currentColor.hex.toUpperCase();
    rgbValue.value = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
    currentColorSection.style.display = 'block';
}

// Save color to palette
saveColorBtn.addEventListener('click', () => {
    if (!currentColor) return;
    
    // Check if color already exists
    const exists = palette.some(c => c.hex === currentColor.hex);
    if (exists) {
        alert('This color is already in your palette!');
        return;
    }
    
    palette.push({ ...currentColor });
    // Sort palette using HSV color space
    palette = sortPaletteByHSV(palette);
    savePalette();
    loadPalette();
    
    // Update planning table
    if (window.updatePlanningTable) {
        window.updatePlanningTable();
    }
    
    // Show feedback
    saveColorBtn.textContent = 'Saved! ✓';
    setTimeout(() => {
        saveColorBtn.textContent = 'Save to Palette';
    }, 2000);
});

// Copy to clipboard
copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-copy');
        const text = type === 'hex' ? hexValue.value : rgbValue.value;
        
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = 'Copy';
            }, 2000);
        });
    });
});

// Load palette from localStorage
function loadPalette() {
    paletteGrid.innerHTML = '';
    
    if (palette.length === 0) {
        paletteGrid.innerHTML = '<p class="empty-message">No colors saved yet. Upload an image and start picking!</p>';
        clearPaletteBtn.style.display = 'none';
        drawPalettePointsOnWheel(); // Clear points if palette is empty
        return;
    }
    
    clearPaletteBtn.style.display = 'block';
    
    palette.forEach((color, index) => {
        const item = createPaletteItem(color, index);
        paletteGrid.appendChild(item);
    });
    
    drawPalettePointsOnWheel(); // Draw palette points on color wheel
}

// Create palette item element
function createPaletteItem(color, index) {
    const item = document.createElement('div');
    item.className = 'palette-item';
    
    const colorDiv = document.createElement('div');
    colorDiv.className = 'palette-color';
    colorDiv.style.backgroundColor = color.hex;
    
    item.innerHTML = `
        <div class="palette-info">
            <div class="palette-hex">${color.hex.toUpperCase()}</div>
            <div class="palette-rgb">rgb(${color.r}, ${color.g}, ${color.b})</div>
        </div>
        <button class="palette-delete" data-index="${index}">×</button>
    `;
    
    // Insert color div at the beginning
    item.insertBefore(colorDiv, item.firstChild);
    
    // Store original color for restoration
    const originalColor = color.hex;
    const originalHsv = rgbToHSV(color.r, color.g, color.b);
    
    // Click to show gradient
    item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('palette-delete') && !e.target.classList.contains('palette-copy')) {
            const gradient = generateValueGradient(originalHsv.h, originalHsv.s);
            colorDiv.style.background = gradient;
            colorDiv.style.backgroundSize = '100% 100%';
        }
    });
    
    // Mouse leave to restore original color
    item.addEventListener('mouseleave', () => {
        colorDiv.style.background = originalColor;
        colorDiv.style.backgroundSize = '';
    });
    
    // Double click to copy hex
    item.addEventListener('dblclick', (e) => {
        if (!e.target.classList.contains('palette-delete')) {
            navigator.clipboard.writeText(color.hex.toUpperCase()).then(() => {
                const hexEl = item.querySelector('.palette-hex');
                const originalText = hexEl.textContent;
                hexEl.textContent = 'Copied!';
                setTimeout(() => {
                    hexEl.textContent = originalText;
                }, 1000);
            });
        }
    });
    
    // Delete button
    const deleteBtn = item.querySelector('.palette-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        palette.splice(index, 1);
        // Re-sort palette after deletion to maintain order
        palette = sortPaletteByHSV(palette);
        savePalette();
        loadPalette();
        
        // Update planning table
        if (window.updatePlanningTable) {
            window.updatePlanningTable();
        }
    });
    
    return item;
}

// Clear palette
clearPaletteBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your entire palette?')) {
        palette = [];
        savePalette();
        loadPalette();
        
        // Update planning table
        if (window.updatePlanningTable) {
            window.updatePlanningTable();
        }
    }
});

// Save palette to localStorage
function savePalette() {
    localStorage.setItem('colorPalette', JSON.stringify(palette));
}

// Utility: Convert RGB to HEX
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Convert RGB to HSV (Hue, Saturation, Value)
function rgbToHSV(r, g, b) {
    r = r / 255;
    g = g / 255;
    b = b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0; // Hue
    let s = 0; // Saturation
    const v = max; // Value
    
    if (delta !== 0) {
        s = delta / max;
        
        if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }
        
        h = h * 60;
        if (h < 0) {
            h += 360;
        }
    }
    
    return { h, s, v };
}

// Convert HSV to RGB
function hsvToRGB(h, s, v) {
    h = h % 360;
    if (h < 0) h += 360;
    
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    
    let r = 0, g = 0, b = 0;
    
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return { r, g, b };
}

// Generate gradient CSS string with same hue and saturation, value from 0 to 1
function generateValueGradient(hue, saturation) {
    const steps = 20; // Number of gradient stops
    const colors = [];
    
    for (let i = 0; i <= steps; i++) {
        const value = i / steps; // Value from 0 to 1
        const rgb = hsvToRGB(hue, saturation, value); // Use original saturation, varying value
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        const position = (i / steps) * 100;
        colors.push(`${hex} ${position}%`);
    }
    
    return `linear-gradient(to right, ${colors.join(', ')})`;
}

// Sort palette using HSV color space (Hue, Saturation, Value)
function sortPaletteByHSV(colors) {
    if (colors.length <= 1) return colors;
    
    // Convert colors to include HSV values and sort
    const colorsWithHSV = colors.map(color => ({
        ...color,
        hsv: rgbToHSV(color.r, color.g, color.b)
    }));
    
    // Sort by Hue first, then Saturation, then Value
    colorsWithHSV.sort((a, b) => {
        // Primary sort: Hue (0-360)
        if (Math.abs(a.hsv.h - b.hsv.h) > 0.01) {
            return a.hsv.h - b.hsv.h;
        }
        // Secondary sort: Saturation (0-1)
        if (Math.abs(a.hsv.s - b.hsv.s) > 0.01) {
            return b.hsv.s - a.hsv.s; // Higher saturation first
        }
        // Tertiary sort: Value (0-1)
        return b.hsv.v - a.hsv.v; // Higher value (brighter) first
    });
    
    // Return colors without HSV property
    return colorsWithHSV.map(({ hsv, ...color }) => color);
}

// Draw color wheel base
function drawColorWheelBase() {
    if (!colorWheelCtx || !colorWheelCanvas) return;
    
    const ctx = colorWheelCtx;
    const size = colorWheelCanvas.width;
    const centerX = colorWheelCenterX;
    const centerY = colorWheelCenterY;
    const radius = colorWheelRadius;
    
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
                data[index] = rgb.r;     // R
                data[index + 1] = rgb.g; // G
                data[index + 2] = rgb.b; // B
                data[index + 3] = 255;   // A
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

// Initialize color wheel
function initColorWheel() {
    const canvas = document.getElementById('colorWheelCanvas');
    if (!canvas) return;
    
    colorWheelCanvas = canvas;
    colorWheelCtx = canvas.getContext('2d');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    
    colorWheelCenterX = size / 2;
    colorWheelCenterY = size / 2;
    colorWheelRadius = size / 2 - 10;
    
    // Draw color wheel base
    drawColorWheelBase();
    
    // Draw palette points on wheel
    drawPalettePointsOnWheel();
    
    // Handle clicks on color wheel (also handle clicks on magnifying glass)
    const handleColorWheelClick = (e) => {
        // Get coordinates relative to canvas, accounting for any scaling
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Calculate click position on canvas
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // First check if a palette point was clicked
        let pointClicked = false;
        for (const point of palettePointPositions) {
            const dx = x - point.x;
            const dy = y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Use a slightly larger clickable radius (10px) for easier clicking
            if (distance <= 10) {
                // Point was clicked - scroll to and highlight the palette item
                e.preventDefault();
                e.stopPropagation();
                highlightAndScrollToPaletteItem(point.colorIndex);
                pointClicked = true;
                return;
            }
        }
        
        // If no point was clicked, handle regular color wheel click
        if (!pointClicked) {
            const dx = x - colorWheelCenterX;
            const dy = y - colorWheelCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= colorWheelRadius) {
                // Get pixel color from canvas
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                
                const hex = rgbToHex(r, g, b);
                
                // Update preview and values
                updateColorWheelPreview(r, g, b, hex);
                
                // Update current color and display
                currentColor = { r, g, b, hex };
                displayCurrentColor();
            }
        }
    };
    
    canvas.addEventListener('click', handleColorWheelClick);
    
    // Show color on hover with magnifying glass
    const magnifyingGlass = document.getElementById('magnifyingGlass');
    const magnifyingCanvas = document.getElementById('magnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    // Also handle clicks on the wrapper (clicks should pass through magnifying glass due to pointer-events: none)
    // But we add this as a backup in case pointer-events doesn't work in some browsers
    // Only add if wrapper exists and is inside the floating wheel
    if (wrapper && wrapper.closest('.floating-color-wheel')) {
        wrapper.addEventListener('click', (e) => {
            // Don't interfere with header clicks (for dragging)
            if (e.target.closest('.floating-wheel-header')) {
                return;
            }
            // If click is on the magnifying glass area, forward to canvas handler
            // The magnifying glass has pointer-events: none, so clicks should normally pass through
            if (e.target === magnifyingGlass || e.target === magnifyingCanvas || 
                (magnifyingGlass && magnifyingGlass.contains(e.target))) {
                handleColorWheelClick(e);
            }
        }, false); // Don't use capture phase to avoid interfering with drag
    }
    
    // Initialize magnifying glass canvas
    if (magnifyingCanvas) {
        magnifyingCanvas.width = 120;
        magnifyingCanvas.height = 120;
    }
    
    let animationFrameId = null;
    let lastUpdateTime = 0;
    const throttleDelay = 16; // ~60fps
    
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
            for (const point of palettePointPositions) {
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
            
            const dx = x - colorWheelCenterX;
            const dy = y - colorWheelCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= colorWheelRadius) {
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                const hex = rgbToHex(r, g, b);
                updateColorWheelPreview(r, g, b, hex);
                
                // Show and update magnifying glass
                if (magnifyingGlass && magnifyingCanvas) {
                    const wrapperRect = wrapper.getBoundingClientRect();
                    const glassSize = 120;
                    const glassX = e.clientX - wrapperRect.left - glassSize / 2;
                    const glassY = e.clientY - wrapperRect.top - glassSize / 2;
                    
                    magnifyingGlass.style.display = 'block';
                    magnifyingGlass.style.left = glassX + 'px';
                    magnifyingGlass.style.top = glassY + 'px';
                    
                    // Create magnified view using canvas directly
                    const zoom = 2;
                    const sourceSize = glassSize / zoom;
                    const sourceX = x - sourceSize / 2;
                    const sourceY = y - sourceSize / 2;
                    
                    const magCtx = magnifyingCanvas.getContext('2d');
                    
                    // Clear and draw the magnified area
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
                // Hide magnifying glass when outside the wheel
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

// Draw palette colors as points on the color wheel
function drawPalettePointsOnWheel() {
    if (!colorWheelCtx || !colorWheelCanvas) return;
    
    // Redraw the base wheel first to clear old points
    drawColorWheelBase();
    
    const ctx = colorWheelCtx;
    const centerX = colorWheelCenterX;
    const centerY = colorWheelCenterY;
    const radius = colorWheelRadius;
    
    // Clear previous point positions
    palettePointPositions = [];
    const pointRadius = 7; // Clickable radius for points
    
    // Draw each palette color as a point
    palette.forEach((color, index) => {
        // Convert RGB to HSV
        const hsv = rgbToHSV(color.r, color.g, color.b);
        
        // Calculate position on color wheel
        // Hue determines angle, saturation determines distance from center
        const angle = (hsv.h * Math.PI) / 180; // Convert to radians
        const distance = hsv.s * radius; // Saturation determines distance
        
        const x = centerX + distance * Math.cos(angle);
        const y = centerY + distance * Math.sin(angle);
        
        // Store point position for click detection
        palettePointPositions.push({
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
        
        // Draw a white circle outline for visibility
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw a black circle outline for contrast
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
    });
}

// Highlight and scroll to palette item
function highlightAndScrollToPaletteItem(index) {
    // Remove previous highlights
    document.querySelectorAll('.palette-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    
    // Find the palette item
    const paletteItems = document.querySelectorAll('.palette-item');
    if (paletteItems[index]) {
        const item = paletteItems[index];
        
        // Add highlight class
        item.classList.add('highlighted');
        
        // Scroll to the item
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
            item.classList.remove('highlighted');
        }, 2000);
    }
}

// Initialize floating color wheel
function initFloatingWheel() {
    const floatingWheel = document.getElementById('floatingColorWheel');
    const showWheelBtn = document.getElementById('showWheelBtn');
    const closeWheelBtn = document.getElementById('closeWheelBtn');
    
    if (!floatingWheel) {
        console.error('Floating wheel not found');
        return;
    }
    if (!showWheelBtn) {
        console.error('Show wheel button not found');
        return;
    }
    if (!closeWheelBtn) {
        console.error('Close wheel button not found');
        return;
    }
    
    const wheelHeader = floatingWheel.querySelector('.floating-wheel-header');
    if (!wheelHeader) {
        console.error('Wheel header not found');
        return;
    }
    
    // Show wheel button
    showWheelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        floatingWheel.style.display = 'block';
    });
    
    // Close wheel button - use multiple event types to ensure it works
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
    
    // Also allow closing by clicking outside (optional - remove if not needed)
    // document.addEventListener('click', (e) => {
    //     if (!floatingWheel.contains(e.target) && e.target !== showWheelBtn) {
    //         // floatingWheel.style.display = 'none';
    //     }
    // });
    
    // Drag functionality
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;
    
    // Get initial position from element or localStorage
    const rect = floatingWheel.getBoundingClientRect();
    xOffset = rect.left;
    yOffset = rect.top;
    
    // Load saved position from localStorage
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
    
    // Make header draggable - use capture phase to catch before other handlers
    wheelHeader.addEventListener('mousedown', (e) => {
        // Don't start dragging if clicking the close button
        if (e.target === closeWheelBtn || e.target.closest('.close-wheel-btn')) {
            return;
        }
        
        // Get current position
        const currentRect = floatingWheel.getBoundingClientRect();
        xOffset = currentRect.left;
        yOffset = currentRect.top;
        
        // Start dragging
        isDragging = true;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Bring to front when dragging starts
        floatingWheel.style.zIndex = '10001';
        
        return false;
    }, true); // Use capture phase to ensure we catch the event first
    
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
            // Save position to localStorage
            try {
                localStorage.setItem('colorWheelPosition', JSON.stringify({
                    x: xOffset,
                    y: yOffset
                }));
            } catch (e) {
                console.error('Error saving position:', e);
            }
            isDragging = false;
            // Reset z-index after dragging
            floatingWheel.style.zIndex = '10000';
        }
    };
    
    // Use capture phase to ensure events are caught
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    
    // Also handle mouseleave to stop dragging if mouse leaves window
    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            floatingWheel.style.zIndex = '10000';
        }
    });
}

// Update color wheel preview
function updateColorWheelPreview(r, g, b, hex) {
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

// Initialize tabs
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(targetTab + 'Tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Load products data
function loadProducts() {
    const productsTable = document.getElementById('productsTable');
    if (!productsTable) return;

    const tbody = productsTable.querySelector('tbody');
    if (!tbody) return;

    // Check if PRODUCTS_DATA is available
    if (typeof PRODUCTS_DATA === 'undefined') {
        tbody.innerHTML = '<tr><td colspan="2">Error loading products. Please make sure products_data.js is loaded.</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    PRODUCTS_DATA.forEach(product => {
        const row = document.createElement('tr');
        
        // Colour column
        const colorCell = document.createElement('td');
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = product.hex;
        colorCell.appendChild(colorBox);
        
        // Paint column
        const paintCell = document.createElement('td');
        const paintName = document.createElement('span');
        paintName.className = 'paint-name';
        paintName.textContent = (product.line || '') + (product.name || '');
        paintCell.appendChild(paintName);
        
        row.appendChild(colorCell);
        row.appendChild(paintCell);
        tbody.appendChild(row);
    });
}

// Load planning table
function loadPlanningTable() {
    const planningTable = document.getElementById('planningTable');
    if (!planningTable) return;

    const tbody = planningTable.querySelector('tbody');
    if (!tbody) return;

    // Function to update planning table
    function updatePlanningTable() {
        tbody.innerHTML = '';

        if (palette.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.textContent = 'No colors in palette yet. Add colors from the Color Picker tab.';
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        palette.forEach(color => {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = color.hex;
            cell.appendChild(colorBox);
            row.appendChild(cell);
            tbody.appendChild(row);
        });
    }

    // Initial load
    updatePlanningTable();

    // Update when palette changes - we'll need to call this from saveColorToPalette
    // Store the update function globally so it can be called
    window.updatePlanningTable = updatePlanningTable;
}

