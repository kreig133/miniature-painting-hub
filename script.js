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
let myCollection = JSON.parse(localStorage.getItem('myCollection')) || [];
let sortOrder = localStorage.getItem('colorSortOrder') || 'hsv'; // Default: Hue-Saturation-Value
// Candidate sources are now always 'merged' - no longer need to store in state
let saturationThreshold = parseFloat(localStorage.getItem('saturationThreshold')) || 90; // Default: 90%
let mergedPaintColors = []; // Merged data source - contains all paint colors from all sources
// Color wheel Value filter settings
let paletteValueMiddle = parseFloat(localStorage.getItem('paletteValueMiddle')) || 50; // Default: 50 (middle)
let paletteValueRange = parseFloat(localStorage.getItem('paletteValueRange')) || 100; // Default: 100 (max)
let collectionValueMiddle = parseFloat(localStorage.getItem('collectionValueMiddle')) || 50; // Default: 50 (middle)
let collectionValueRange = parseFloat(localStorage.getItem('collectionValueRange')) || 100; // Default: 100 (max)
let ctx = imageCanvas.getContext('2d');
let colorWheelCanvas = null;
let colorWheelCtx = null;
let colorWheelCenterX = 0;
let colorWheelCenterY = 0;
let colorWheelRadius = 0;
let palettePointPositions = []; // Store positions of palette points on the wheel

// Collection wheel variables
let collectionWheelCanvas = null;
let collectionWheelCtx = null;
let collectionWheelCenterX = 0;
let collectionWheelCenterY = 0;
let collectionWheelRadius = 0;
let collectionPointPositions = []; // Store positions of collection points on the wheel

// Initialize
// Sort palette with saved sort order on load
palette = sortPaletteByHSV(palette, sortOrder);
savePalette(); // Save the sorted palette
loadPalette();
initColorWheel();
initTabs();
mergePaintColorsData();
// Initialize filter checkboxes after data is merged
createFilterCheckboxes('paintColorsFilters');
createFilterCheckboxes('myCollectionFilters');
createFilterCheckboxes('planningFilters');
createFilterCheckboxes('selectedColorFilters');
loadPaintColors();
loadMyCollection();
loadPlanningTable();
initSortOrder();
initSaturationThreshold();
initSelectedColorFilterToggle();
initColorWheelSliders();
// Add gradient click to color preview (will be updated when color changes)
if (colorPreview) {
    colorPreview.addEventListener('click', function() {
        if (currentColor) {
            const gradient = generateSplitGradient(currentColor.hex, currentColor.r, currentColor.g, currentColor.b);
            this.style.backgroundImage = gradient;
            this.style.backgroundSize = '100% 50%, 100% 50%';
            this.style.backgroundPosition = 'top, bottom';
            this.style.backgroundRepeat = 'no-repeat';
        }
    });
    colorPreview.addEventListener('mouseleave', function() {
        this.style.backgroundImage = '';
        this.style.backgroundSize = '';
        this.style.backgroundPosition = '';
        this.style.backgroundRepeat = '';
        if (currentColor) {
            this.style.backgroundColor = currentColor.hex;
        }
    });
}

// Initialize floating wheel - use setTimeout to ensure DOM is fully ready
setTimeout(() => {
    initFloatingWheel();
    initCollectionFloatingWheel();
    initCollectionWheel();
    initColorWheelSliders();
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

// Initialize magnifying glass for image canvas
const imageMagnifyingGlass = document.getElementById('imageMagnifyingGlass');
const imageMagnifyingCanvas = document.getElementById('imageMagnifyingGlassCanvas');
const imageCanvasContainer = imageCanvas.parentElement;

if (imageMagnifyingCanvas) {
    imageMagnifyingCanvas.width = 120;
    imageMagnifyingCanvas.height = 120;
}

let imageAnimationFrameId = null;
let imageLastUpdateTime = 0;
const imageThrottleDelay = 16; // ~60fps

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
            
            cursorInfo.textContent = `X: ${x}, Y: ${y} | ${hex}`;
            cursorInfo.style.display = 'block';
            cursorInfo.style.left = `${e.clientX - rect.left + 10}px`;
            cursorInfo.style.top = `${e.clientY - rect.top + 10}px`;
            
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
            cursorInfo.style.display = 'none';
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
    cursorInfo.style.display = 'none';
});

// Display current color
function displayCurrentColor() {
    if (!currentColor) return;
    
    colorPreview.style.backgroundColor = currentColor.hex;
    hexValue.value = currentColor.hex.toUpperCase();
    rgbValue.value = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
    currentColorSection.style.display = 'block';
    
    // Find and display closest matches
    updateClosestMatches();
}

// Update closest matches display
function updateClosestMatches() {
    if (!currentColor) return;
    
    // Find closest from palette (no filters - always from user's palette)
    const palette1 = findClosestFromPalette(currentColor);
    const palette2 = findNthClosestFromPalette(currentColor, 2);
    
    // Find closest from my collection (apply filters)
    const collection1 = findClosestFromMyCollection(currentColor, 'selectedColorFilters');
    const collection2 = findNthClosestFromMyCollection(currentColor, 2, 'selectedColorFilters');
    
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
    
    // Update Collection 1
    const collection1Color = document.getElementById('collection1Color');
    if (collection1Color) {
        if (collection1) {
            collection1Color.style.backgroundColor = collection1.hex;
            collection1Color.style.display = 'block';
            addGradientClickToColorBox(collection1Color, collection1.hex);
            // Store color data for tooltip
            collection1Color.dataset.colorName = collection1.name || '';
            collection1Color.dataset.colorType = Array.isArray(collection1.type) ? collection1.type.join(', ') : (collection1.type || '');
            collection1Color.dataset.colorProducer = collection1.producer || '';
            // Add hover tooltip
            addHoverTooltipToColorBox(collection1Color);
        } else {
            collection1Color.style.display = 'none';
            // Remove tooltip data
            delete collection1Color.dataset.colorName;
            delete collection1Color.dataset.colorType;
            delete collection1Color.dataset.colorProducer;
            delete collection1Color.dataset.tooltipAttached;
            // Remove tooltip element
            const tooltip = collection1Color.querySelector('.color-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        }
    }
    
    // Update Collection 2
    const collection2Color = document.getElementById('collection2Color');
    if (collection2Color) {
        if (collection2) {
            collection2Color.style.backgroundColor = collection2.hex;
            collection2Color.style.display = 'block';
            addGradientClickToColorBox(collection2Color, collection2.hex);
            // Store color data for tooltip
            collection2Color.dataset.colorName = collection2.name || '';
            collection2Color.dataset.colorType = Array.isArray(collection2.type) ? collection2.type.join(', ') : (collection2.type || '');
            collection2Color.dataset.colorProducer = collection2.producer || '';
            // Add hover tooltip
            addHoverTooltipToColorBox(collection2Color);
        } else {
            collection2Color.style.display = 'none';
            // Remove tooltip data
            delete collection2Color.dataset.colorName;
            delete collection2Color.dataset.colorType;
            delete collection2Color.dataset.colorProducer;
            delete collection2Color.dataset.tooltipAttached;
            // Remove tooltip element
            const tooltip = collection2Color.querySelector('.color-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        }
    }
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
    palette = sortPaletteByHSV(palette, sortOrder);
    savePalette();
    loadPalette();
    // Update closest matches when palette changes
    if (currentColor) {
        updateClosestMatches();
    }
    // Update closest matches when palette changes
    updateClosestMatches();
    
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
            const gradient = generateSplitGradient(originalColor, color.r, color.g, color.b);
            colorDiv.style.backgroundImage = gradient;
            colorDiv.style.backgroundSize = '100% 50%, 100% 50%';
            colorDiv.style.backgroundPosition = 'top, bottom';
            colorDiv.style.backgroundRepeat = 'no-repeat';
        }
    });
    
    // Mouse leave to restore original color
    item.addEventListener('mouseleave', () => {
        colorDiv.style.backgroundImage = '';
        colorDiv.style.backgroundSize = '';
        colorDiv.style.backgroundPosition = '';
        colorDiv.style.backgroundRepeat = '';
        colorDiv.style.backgroundColor = originalColor;
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
        palette = sortPaletteByHSV(palette, sortOrder);
        savePalette();
        loadPalette();
        
        // Update planning table
        if (window.updatePlanningTable) {
            window.updatePlanningTable();
        }
        // Update closest matches when palette changes
        if (currentColor) {
            updateClosestMatches();
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
        // Update closest matches when palette is cleared
        if (currentColor) {
            updateClosestMatches();
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

// Calculate distance in HSV color space
// Hue difference is multiplied by 4 and handles circular wraparound
function hsvDistance(hsv1, hsv2) {
    // Calculate hue difference with wraparound (hue is circular 0-360)
    let hueDiff = Math.abs(hsv1.h - hsv2.h);
    if (hueDiff > 180) {
        hueDiff = 360 - hueDiff; // Take the shorter path around the circle
    }
    
    // Multiply hue difference by 3
    const weightedHueDiff = hueDiff * 3;
    
    // Calculate saturation and value differences (0-1 range)
    const satDiff = hsv1.s - hsv2.s;
    const valDiff = hsv1.v - hsv2.v;
    
    // Calculate Euclidean distance in HSV space
    const distance = Math.sqrt(
        Math.pow(weightedHueDiff, 2) +
        Math.pow(satDiff, 2) +
        Math.pow(valDiff, 2)
    );
    
    return distance;
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

// Generate split gradient: upper half (white to color), lower half (color to black)
function generateSplitGradient(colorHex, colorR, colorG, colorB) {
    // Upper gradient: white to color (left to right)
    const upperGradient = `linear-gradient(to right, #FFFFFF, ${colorHex})`;
    
    // Lower gradient: color to black (left to right)
    const lowerGradient = `linear-gradient(to right, ${colorHex}, #000000)`;
    
    // Combine both gradients, each taking 50% height
    return `${upperGradient}, ${lowerGradient}`;
}

// Add gradient click functionality to a color box element
function addGradientClickToColorBox(colorBox, colorHex) {
    // Parse hex to get RGB values
    const hex = colorHex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const originalColor = colorHex;
    let isShowingGradient = false;
    
    colorBox.addEventListener('click', (e) => {
        // Don't trigger if clicking on child elements
        if (e.target !== colorBox && !colorBox.contains(e.target)) {
            return;
        }
        
        if (!isShowingGradient) {
            const gradient = generateSplitGradient(originalColor, r, g, b);
            colorBox.style.backgroundImage = gradient;
            colorBox.style.backgroundSize = '100% 50%, 100% 50%';
            colorBox.style.backgroundPosition = 'top, bottom';
            colorBox.style.backgroundRepeat = 'no-repeat';
            isShowingGradient = true;
        } else {
            // Click again to restore
            colorBox.style.backgroundImage = '';
            colorBox.style.backgroundSize = '';
            colorBox.style.backgroundPosition = '';
            colorBox.style.backgroundRepeat = '';
            colorBox.style.backgroundColor = originalColor;
            isShowingGradient = false;
        }
    });
    
    // Mouse leave to restore original color
    colorBox.addEventListener('mouseleave', () => {
        if (isShowingGradient) {
            colorBox.style.backgroundImage = '';
            colorBox.style.backgroundSize = '';
            colorBox.style.backgroundPosition = '';
            colorBox.style.backgroundRepeat = '';
            colorBox.style.backgroundColor = originalColor;
            isShowingGradient = false;
        }
    });
}

// Sort palette using HSV color space (Hue, Saturation, Value)
function sortPaletteByHSV(colors, sortOrder = 'hsv') {
    if (colors.length <= 1) return colors;
    
    // Convert colors to include HSV values and sort
    const colorsWithHSV = colors.map(color => ({
        ...color,
        hsv: rgbToHSV(color.r, color.g, color.b)
    }));
    
    // Define sort order based on parameter
    // sortOrder is a string like 'hsv', 'hvs', 'shv', etc.
    const order = sortOrder.toLowerCase();
    
    colorsWithHSV.sort((a, b) => {
        // Helper function to compare two HSV values based on order
        const compare = (val1, val2, reverse = false) => {
            const diff = val1 - val2;
            // Use threshold to avoid floating point precision issues
            if (Math.abs(diff) > 0.01) {
                return reverse ? -diff : diff;
            }
            return null; // Values are equal
        };
        
        // Primary sort
        let result = null;
        if (order[0] === 'h') {
            result = compare(a.hsv.h, b.hsv.h);
        } else if (order[0] === 's') {
            result = compare(a.hsv.s, b.hsv.s, true); // Higher saturation first
        } else if (order[0] === 'v') {
            result = compare(a.hsv.v, b.hsv.v, true); // Higher value first
        }
        if (result !== null) return result;
        
        // Secondary sort
        if (order[1] === 'h') {
            result = compare(a.hsv.h, b.hsv.h);
        } else if (order[1] === 's') {
            result = compare(a.hsv.s, b.hsv.s, true);
        } else if (order[1] === 'v') {
            result = compare(a.hsv.v, b.hsv.v, true);
        }
        if (result !== null) return result;
        
        // Tertiary sort
        if (order[2] === 'h') {
            result = compare(a.hsv.h, b.hsv.h);
        } else if (order[2] === 's') {
            result = compare(a.hsv.s, b.hsv.s, true);
        } else if (order[2] === 'v') {
            result = compare(a.hsv.v, b.hsv.v, true);
        }
        return result !== null ? result : 0;
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
    
    // Calculate Value range (0-100 scale)
    const valueMin = paletteValueMiddle - (paletteValueRange / 2);
    const valueMax = paletteValueMiddle + (paletteValueRange / 2);
    
    // Draw each palette color as a point
    palette.forEach((color, index) => {
        // Convert RGB to HSV
        const hsv = rgbToHSV(color.r, color.g, color.b);
        
        // Convert Value from 0-1 to 0-100 for comparison
        const valuePercent = hsv.v * 100;
        
        // Filter by Value range
        if (valuePercent < valueMin || valuePercent > valueMax) {
            return; // Skip this color if it's outside the range
        }
        
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
// Draw collection wheel base
function drawCollectionWheelBase() {
    if (!collectionWheelCtx || !collectionWheelCanvas) return;
    
    const ctx = collectionWheelCtx;
    const size = collectionWheelCanvas.width;
    const centerX = collectionWheelCenterX;
    const centerY = collectionWheelCenterY;
    const radius = collectionWheelRadius;
    
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

// Draw collection points on wheel
function drawCollectionPointsOnWheel() {
    if (!collectionWheelCtx || !collectionWheelCanvas) return;
    
    // Redraw the base wheel first to clear old points
    drawCollectionWheelBase();
    
    const ctx = collectionWheelCtx;
    const centerX = collectionWheelCenterX;
    const centerY = collectionWheelCenterY;
    const radius = collectionWheelRadius;
    
    // Clear previous point positions
    collectionPointPositions = [];
    const pointRadius = 7; // Clickable radius for points
    
    // Apply filters to collection
    const filteredCollection = filterData(myCollection, 'myCollectionFilters');
    
    // Calculate Value range (0-100 scale)
    const valueMin = collectionValueMiddle - (collectionValueRange / 2);
    const valueMax = collectionValueMiddle + (collectionValueRange / 2);
    
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
            const hex = color.hex.replace('#', '');
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        }
        
        // Convert RGB to HSV
        const hsv = rgbToHSV(r, g, b);
        
        // Convert Value from 0-1 to 0-100 for comparison
        const valuePercent = hsv.v * 100;
        
        // Filter by Value range
        if (valuePercent < valueMin || valuePercent > valueMax) {
            return; // Skip this color if it's outside the range
        }
        
        // Calculate position on color wheel
        // Hue determines angle, saturation determines distance from center
        const angle = (hsv.h * Math.PI) / 180; // Convert to radians
        const distance = hsv.s * radius; // Saturation determines distance
        
        const x = centerX + distance * Math.cos(angle);
        const y = centerY + distance * Math.sin(angle);
        
        // Store point position for click detection (use original index)
        collectionPointPositions.push({
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
        
        // Draw a white circle outline for visibility
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw a black circle outline for visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.stroke();
    });
}

// Initialize collection color wheel
function initCollectionWheel() {
    const canvas = document.getElementById('collectionWheelCanvas');
    if (!canvas) return;
    
    collectionWheelCanvas = canvas;
    collectionWheelCtx = canvas.getContext('2d');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    
    collectionWheelCenterX = size / 2;
    collectionWheelCenterY = size / 2;
    collectionWheelRadius = size / 2 - 10;
    
    // Draw color wheel base
    drawCollectionWheelBase();
    
    // Draw collection points on wheel
    drawCollectionPointsOnWheel();
    
    // Handle clicks on color wheel
    const handleCollectionWheelClick = (e) => {
        // Get coordinates relative to canvas, accounting for any scaling
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Calculate click position on canvas
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // First check if a collection point was clicked
        let pointClicked = false;
        for (const point of collectionPointPositions) {
            const dx = x - point.x;
            const dy = y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Use a slightly larger clickable radius (10px) for easier clicking
            if (distance <= 10) {
                // Point was clicked - scroll to and highlight the collection item
                e.preventDefault();
                e.stopPropagation();
                highlightAndScrollToCollectionItem(point.colorIndex);
                pointClicked = true;
                return;
            }
        }
    };
    
    canvas.addEventListener('click', handleCollectionWheelClick);
    
    // Show color on hover with magnifying glass
    const magnifyingGlass = document.getElementById('collectionMagnifyingGlass');
    const magnifyingCanvas = document.getElementById('collectionMagnifyingGlassCanvas');
    const wrapper = canvas.parentElement;
    
    // Also handle clicks on the wrapper
    if (wrapper && wrapper.closest('.floating-color-wheel')) {
        wrapper.addEventListener('click', (e) => {
            // Don't interfere with header clicks (for dragging)
            if (e.target.closest('.floating-wheel-header')) {
                return;
            }
            // If click is on the magnifying glass area, forward to canvas handler
            if (e.target === magnifyingGlass || e.target === magnifyingCanvas || 
                (magnifyingGlass && magnifyingGlass.contains(e.target))) {
                handleCollectionWheelClick(e);
            }
        }, false);
    }
    
    // Initialize magnifying glass canvas
    if (magnifyingCanvas) {
        magnifyingCanvas.width = 120;
        magnifyingCanvas.height = 120;
    }
    
    let animationFrameId = null;
    let lastUpdateTime = 0;
    const throttleDelay = 16; // ~60fps
    
    // Update magnifying glass on mouse move
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

// Update collection magnifying glass
function updateCollectionMagnifyingGlass(e, wrapper, canvas, magnifyingGlass, magnifyingCanvas) {
    if (!magnifyingGlass || !magnifyingCanvas || !canvas) return;
    
    // Check if mouse is over canvas
    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - canvasRect.left;
    const canvasY = e.clientY - canvasRect.top;
    
    if (canvasX < 0 || canvasX > canvasRect.width || canvasY < 0 || canvasY > canvasRect.height) {
        magnifyingGlass.style.display = 'none';
        return;
    }
    
    // Position magnifying glass centered on mouse cursor
    const wrapperRect = wrapper.getBoundingClientRect();
    const glassSize = 120;
    const glassX = e.clientX - wrapperRect.left - glassSize / 2;
    const glassY = e.clientY - wrapperRect.top - glassSize / 2;
    
    // Show magnifying glass
    magnifyingGlass.style.display = 'block';
    magnifyingGlass.style.left = glassX + 'px';
    magnifyingGlass.style.top = glassY + 'px';
    
    // Get canvas coordinates (accounting for scaling)
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    const x = canvasX * scaleX;
    const y = canvasY * scaleY;
    
    // Create magnified view using canvas directly (matching palette wheel style)
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

// Highlight and scroll to collection item
function highlightAndScrollToCollectionItem(index) {
    const table = document.getElementById('myCollectionTable');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // Get the color from myCollection using the original index
    if (index < 0 || index >= myCollection.length) return;
    const targetColor = myCollection[index];
    
    // Find the row in the filtered table that matches this color
    const rows = tbody.querySelectorAll('tr');
    let targetRow = null;
    
    rows.forEach(row => {
        // Check if this row matches the target color
        const colorBox = row.querySelector('.color-box');
        const nameSpan = row.querySelector('.paint-name');
        const producerCell = row.cells[2]; // Producer is in the 3rd column (index 2)
        
        if (colorBox && nameSpan && producerCell) {
            const rowHex = colorBox.style.backgroundColor;
            const rowName = nameSpan.textContent;
            const rowProducer = producerCell.textContent;
            
            // Convert hex to rgb for comparison
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
        // Remove previous highlight
        rows.forEach(r => r.classList.remove('highlighted'));
        
        // Add highlight
        targetRow.classList.add('highlighted');
        
        // Scroll to row
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
            targetRow.classList.remove('highlighted');
        }, 2000);
    }
}

// Helper function to convert hex to RGB object
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

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

// Initialize collection floating wheel
function initCollectionFloatingWheel() {
    const floatingWheel = document.getElementById('floatingCollectionWheel');
    const showWheelBtn = document.getElementById('showCollectionWheelBtn');
    const closeWheelBtn = document.getElementById('closeCollectionWheelBtn');
    
    if (!floatingWheel) {
        console.error('Collection floating wheel not found');
        return;
    }
    if (!showWheelBtn) {
        console.error('Show collection wheel button not found');
        return;
    }
    if (!closeWheelBtn) {
        console.error('Close collection wheel button not found');
        return;
    }
    
    const wheelHeader = floatingWheel.querySelector('.floating-wheel-header');
    if (!wheelHeader) {
        console.error('Collection wheel header not found');
        return;
    }
    
    // Hide wheel by default
    floatingWheel.style.display = 'none';
    
    // Show wheel button - use event delegation on document to ensure it works
    // even if button is inside a hidden tab
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'showCollectionWheelBtn') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Show collection wheel button clicked');
            if (floatingWheel) {
                floatingWheel.style.display = 'block';
            }
            return false;
        }
    }, true); // Use capture phase
    
    // Also attach directly to the button as backup
    showWheelBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('Show collection wheel button clicked (direct)');
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
    
    // Get initial position - default to right side
    // Use a fixed width estimate (400px for the wheel + padding) since element might be hidden
    const wheelWidth = 450; // Approximate width of the floating wheel
    const defaultX = window.innerWidth - wheelWidth - 20; // 20px from right edge
    const defaultY = 100; // 100px from top
    
    xOffset = defaultX;
    yOffset = defaultY;
    
    // Load saved position from localStorage
    const savedPosition = localStorage.getItem('collectionWheelPosition');
    if (savedPosition) {
        try {
            const pos = JSON.parse(savedPosition);
            if (pos.x !== undefined && pos.y !== undefined) {
                // Validate that saved position is within viewport
                const maxX = window.innerWidth - wheelWidth;
                const maxY = window.innerHeight - 400; // Approximate height
                
                if (pos.x >= 0 && pos.x <= maxX && pos.y >= 0 && pos.y <= maxY) {
                    xOffset = pos.x;
                    yOffset = pos.y;
                } else {
                    // Saved position is out of bounds, use default
                    xOffset = defaultX;
                    yOffset = defaultY;
                }
                floatingWheel.style.left = xOffset + 'px';
                floatingWheel.style.top = yOffset + 'px';
            }
        } catch (e) {
            console.error('Error loading saved collection wheel position:', e);
            // Use default position
            xOffset = defaultX;
            yOffset = defaultY;
            floatingWheel.style.left = xOffset + 'px';
            floatingWheel.style.top = yOffset + 'px';
        }
    } else {
        // Use default position (right side)
        floatingWheel.style.left = xOffset + 'px';
        floatingWheel.style.top = yOffset + 'px';
    }
    
    // Make header draggable
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
            // Save position to localStorage
            try {
                localStorage.setItem('collectionWheelPosition', JSON.stringify({
                    x: xOffset,
                    y: yOffset
                }));
            } catch (e) {
                console.error('Error saving collection wheel position:', e);
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

// Merge all paint color data sources into one array
function mergePaintColorsData() {
    mergedPaintColors = [];
    
    // Helper function to format name with code
    function formatName(item) {
        const name = item.name || item.name_en || '';
        if (item.code) {
            return `${name}(${item.code})`;
        }
        return name;
    }
    
    // Process Vallejo Model Colors
    if (typeof VALLEJO_MODEL_COLORS !== 'undefined' && VALLEJO_MODEL_COLORS && VALLEJO_MODEL_COLORS.length > 0) {
        VALLEJO_MODEL_COLORS.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'Vallejo'
            });
        });
    }
    
    // Process Vallejo Model Air Colors
    if (typeof VALLEJO_MODEL_AIR_COLORS !== 'undefined' && VALLEJO_MODEL_AIR_COLORS && VALLEJO_MODEL_AIR_COLORS.length > 0) {
        VALLEJO_MODEL_AIR_COLORS.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'Vallejo'
            });
        });
    }
    
    // Process Vallejo Game Color
    if (typeof VALLEJO_GAME_COLOR_DATA !== 'undefined' && VALLEJO_GAME_COLOR_DATA && VALLEJO_GAME_COLOR_DATA.length > 0) {
        VALLEJO_GAME_COLOR_DATA.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'Vallejo'
            });
        });
    }
    
    // Process Army Painter Speedpaint 2.0
    if (typeof ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS !== 'undefined' && ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS && ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS.length > 0) {
        ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS.forEach(item => {
            mergedPaintColors.push({
                name: item.name || '',
                hex: item.hex,
                type: item.type || [],
                producer: 'Army Painter'
            });
        });
    }
    
    // Process Army Painter Warpaints Fanatic
    if (typeof ARMY_PAINTER_WARPANTS_FANATIC_COLOURS !== 'undefined' && ARMY_PAINTER_WARPANTS_FANATIC_COLOURS && ARMY_PAINTER_WARPANTS_FANATIC_COLOURS.length > 0) {
        ARMY_PAINTER_WARPANTS_FANATIC_COLOURS.forEach(item => {
            mergedPaintColors.push({
                name: item.name || '',
                hex: item.hex,
                type: item.type || [],
                producer: 'Army Painter'
            });
        });
    }
    
    // Process AK Interactive 3rd Gen
    if (typeof AK_INTERACTIVE_3GEN_DATA !== 'undefined' && AK_INTERACTIVE_3GEN_DATA && AK_INTERACTIVE_3GEN_DATA.length > 0) {
        AK_INTERACTIVE_3GEN_DATA.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'AK'
            });
        });
    }
    
    // Process AK Interactive Quick Gen
    if (typeof AK_INTERACTIVE_QUICK_GEN !== 'undefined' && AK_INTERACTIVE_QUICK_GEN && AK_INTERACTIVE_QUICK_GEN.length > 0) {
        AK_INTERACTIVE_QUICK_GEN.forEach(item => {
            mergedPaintColors.push({
                name: formatName(item),
                hex: item.hex,
                type: item.type || [],
                producer: 'AK'
            });
        });
    }
}

// Get unique producers and types from merged data
function getUniqueProducersAndTypes() {
    const producers = new Set();
    const types = new Set();
    
    mergedPaintColors.forEach(item => {
        if (item.producer) {
            producers.add(item.producer);
        }
        if (item.type && Array.isArray(item.type)) {
            item.type.forEach(type => {
                if (type) {
                    types.add(type);
                }
            });
        }
    });
    
    return {
        producers: Array.from(producers).sort(),
        types: Array.from(types).sort()
    };
}

// Create filter checkboxes
function createFilterCheckboxes(containerId) {
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
        // Trigger reload
        if (containerId === 'paintColorsFilters') {
            loadPaintColors();
        } else if (containerId === 'myCollectionFilters') {
            loadMyCollection();
            // Update collection wheel when filters change
            if (collectionWheelCanvas && collectionWheelCtx) {
                drawCollectionPointsOnWheel();
            }
        } else if (containerId === 'planningFilters') {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        }
    });
    
    const producerAllBtn = document.createElement('button');
    producerAllBtn.className = 'filter-action-btn';
    producerAllBtn.textContent = 'all';
    producerAllBtn.type = 'button';
    producerAllBtn.addEventListener('click', () => {
        const producerCheckboxes = producerGroup.querySelectorAll('input[data-filter-type="producer"]');
        producerCheckboxes.forEach(cb => cb.checked = true);
        // Trigger reload
        if (containerId === 'paintColorsFilters') {
            loadPaintColors();
        } else if (containerId === 'myCollectionFilters') {
            loadMyCollection();
            // Update collection wheel when filters change
            if (collectionWheelCanvas && collectionWheelCtx) {
                drawCollectionPointsOnWheel();
            }
        } else if (containerId === 'planningFilters') {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        } else if (containerId === 'selectedColorFilters') {
            // Update closest matches when filters change
            if (currentColor) {
                updateClosestMatches();
            }
        }
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
        // Trigger reload
        if (containerId === 'paintColorsFilters') {
            loadPaintColors();
        } else if (containerId === 'myCollectionFilters') {
            loadMyCollection();
            // Update collection wheel when filters change
            if (collectionWheelCanvas && collectionWheelCtx) {
                drawCollectionPointsOnWheel();
            }
        } else if (containerId === 'planningFilters') {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        } else if (containerId === 'selectedColorFilters') {
            // Update closest matches when filters change
            if (currentColor) {
                updateClosestMatches();
            }
        }
    });
    
    const typeAllBtn = document.createElement('button');
    typeAllBtn.className = 'filter-action-btn';
    typeAllBtn.textContent = 'all';
    typeAllBtn.type = 'button';
    typeAllBtn.addEventListener('click', () => {
        const typeCheckboxes = typeGroup.querySelectorAll('input[data-filter-type="type"]');
        typeCheckboxes.forEach(cb => cb.checked = true);
        // Trigger reload
        if (containerId === 'paintColorsFilters') {
            loadPaintColors();
        } else if (containerId === 'myCollectionFilters') {
            loadMyCollection();
            // Update collection wheel when filters change
            if (collectionWheelCanvas && collectionWheelCtx) {
                drawCollectionPointsOnWheel();
            }
        } else if (containerId === 'planningFilters') {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        } else if (containerId === 'selectedColorFilters') {
            // Update closest matches when filters change
            if (currentColor) {
                updateClosestMatches();
            }
        }
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
            // Trigger reload of the appropriate table
            if (containerId === 'paintColorsFilters') {
                loadPaintColors();
            } else if (containerId === 'myCollectionFilters') {
                loadMyCollection();
                // Update collection wheel when filters change
                if (collectionWheelCanvas && collectionWheelCtx) {
                    drawCollectionPointsOnWheel();
                }
            } else if (containerId === 'planningFilters') {
                if (window.updatePlanningTable) {
                    window.updatePlanningTable();
                }
            } else if (containerId === 'selectedColorFilters') {
                // Update closest matches when filters change
                if (currentColor) {
                    updateClosestMatches();
                }
            }
        });
    });
}

// Get selected filter values
function getSelectedFilters(containerId) {
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
function filterData(data, containerId) {
    const filters = getSelectedFilters(containerId);
    
    // If no filters selected, show all (all are selected by default)
    if (filters.producers.length === 0 && filters.types.length === 0) {
        return data;
    }
    
    return data.filter(item => {
        // Check producer filter
        let producerMatch = true;
        if (filters.producers.length > 0) {
            producerMatch = filters.producers.includes(item.producer);
        }
        
        // Check type filter - item must have at least one type from selected types
        let typeMatch = true;
        if (filters.types.length > 0) {
            if (!item.type || !Array.isArray(item.type) || item.type.length === 0) {
                typeMatch = false;
            } else {
                typeMatch = item.type.some(type => filters.types.includes(type));
            }
        }
        
        return producerMatch && typeMatch;
    });
}

// Save myCollection to localStorage
function saveMyCollection() {
    localStorage.setItem('myCollection', JSON.stringify(myCollection));
}

// Add color to myCollection
function addToMyCollection(colorData) {
    // Check if color already exists (by hex and name)
    const exists = myCollection.some(item => 
        item.hex === colorData.hex && 
        item.name === colorData.name
    );
    
    if (!exists) {
        myCollection.push(colorData);
        saveMyCollection();
        loadMyCollection();
        // Update collection wheel
        if (collectionWheelCanvas && collectionWheelCtx) {
            drawCollectionPointsOnWheel();
        }
        // Update planning table if it exists
        if (window.updatePlanningTable) {
            window.updatePlanningTable();
        }
        // Update closest matches when collection changes
        if (currentColor) {
            updateClosestMatches();
        }
        return true;
    }
    return false;
}

// Update header with count
function updateHeaderCount(headerId, filteredCount, totalCount) {
    const header = document.getElementById(headerId);
    if (!header) return;
    
    // Extract base name (text before any existing count)
    const baseText = header.textContent.split(' (')[0];
    header.textContent = `${baseText} (${filteredCount}/${totalCount})`;
}

// Load paint colors from merged data source
function loadPaintColors() {
    const paintColorsTable = document.getElementById('paintColorsTable');
    if (!paintColorsTable) return;

    const tbody = paintColorsTable.querySelector('tbody');
    if (!tbody) return;

    // Use merged data source
    if (!mergedPaintColors || mergedPaintColors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No paint colors available. Please make sure data files are loaded.</td></tr>';
        updateHeaderCount('paintColorsHeader', 0, 0);
        return;
    }

    // Apply filters
    const filteredData = filterData(mergedPaintColors, 'paintColorsFilters');
    
    // Update header count
    updateHeaderCount('paintColorsHeader', filteredData.length, mergedPaintColors.length);

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No colors match the selected filters.</td></tr>';
        return;
    }

    filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'collection-row';
        
        // Colour column
        const colorCell = document.createElement('td');
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = item.hex;
        addGradientClickToColorBox(colorBox, item.hex);
        colorCell.appendChild(colorBox);
        
        // Name column
        const nameCell = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'paint-name';
        nameSpan.textContent = item.name || '';
        nameCell.appendChild(nameSpan);
        
        // Add type row
        if (item.type && Array.isArray(item.type) && item.type.length > 0) {
            const typeSpan = document.createElement('span');
            typeSpan.className = 'paint-type';
            typeSpan.textContent = item.type.join(', ');
            nameCell.appendChild(typeSpan);
        }
        
        // Add button column
        const addCell = document.createElement('td');
        addCell.className = 'add-button-cell';
        const addBtn = document.createElement('button');
        addBtn.className = 'add-to-collection-btn';
        addBtn.textContent = '+';
        addBtn.title = 'Add to My Collection';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Copy name as displayed (from the nameSpan element)
            const displayedName = nameSpan.textContent || '';
            
            const colorData = {
                name: displayedName,
                hex: item.hex,
                type: item.type || [],
                producer: item.producer || ''
            };
            if (addToMyCollection(colorData)) {
                addBtn.textContent = '✓';
                addBtn.classList.add('added');
                setTimeout(() => {
                    addBtn.textContent = '+';
                    addBtn.classList.remove('added');
                }, 1000);
            }
        });
        addCell.appendChild(addBtn);
        
        row.appendChild(colorCell);
        row.appendChild(nameCell);
        row.appendChild(addCell);
        tbody.appendChild(row);
    });
}

// Load My Collection
function loadMyCollection() {
    const myCollectionTable = document.getElementById('myCollectionTable');
    if (!myCollectionTable) return;

    const tbody = myCollectionTable.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (myCollection.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No colors in collection yet. Add colors from Paint Colors tab.';
        row.appendChild(cell);
        tbody.appendChild(row);
        updateHeaderCount('myCollectionHeader', 0, 0);
        return;
    }

    // Apply filters
    const filteredCollection = filterData(myCollection, 'myCollectionFilters');
    
    // Update header count
    updateHeaderCount('myCollectionHeader', filteredCollection.length, myCollection.length);

    if (filteredCollection.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No colors match the selected filters.';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    filteredCollection.forEach((item) => {
        const row = document.createElement('tr');
        row.className = 'collection-row';
        
        // Find the original index in myCollection
        const originalIndex = myCollection.findIndex(origItem => 
            origItem.hex === item.hex && 
            origItem.name === item.name &&
            origItem.producer === item.producer
        );
        
        // Colour column
        const colorCell = document.createElement('td');
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = item.hex;
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
        
        // Delete button column
        const deleteCell = document.createElement('td');
        deleteCell.className = 'delete-button-cell';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-from-collection-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove from My Collection';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Remove item from collection using original index
            if (originalIndex !== -1) {
                myCollection.splice(originalIndex, 1);
                saveMyCollection();
                loadMyCollection();
                // Update planning table if it exists
                if (window.updatePlanningTable) {
                    window.updatePlanningTable();
                }
                // Update closest matches when collection changes
                if (currentColor) {
                    updateClosestMatches();
                }
            }
        });
        deleteCell.appendChild(deleteBtn);
        
        row.appendChild(colorCell);
        row.appendChild(nameCell);
        row.appendChild(producerCell);
        row.appendChild(deleteCell);
        tbody.appendChild(row);
    });
    
    // Update collection wheel
    if (collectionWheelCanvas && collectionWheelCtx) {
        drawCollectionPointsOnWheel();
    }
}

// Find closest color from specified data source
function findClosestColor(targetColor, source = 'merged', filterContainerId = null) {
    let dataSource = null;
    
    // Use merged data source
    if (source === 'merged' || !source) {
        if (!mergedPaintColors || mergedPaintColors.length === 0) {
            return null;
        }
        dataSource = mergedPaintColors;
        
        // Apply filters if filter container ID is provided
        if (filterContainerId) {
            dataSource = filterData(dataSource, filterContainerId);
        }
    } else {
        // Legacy support for old source names (for backward compatibility)
        if (source === 'vallejo_model_colours' || source === 'vallejo') {
            if (typeof VALLEJO_MODEL_COLORS === 'undefined' || !VALLEJO_MODEL_COLORS || VALLEJO_MODEL_COLORS.length === 0) {
                return null;
            }
            dataSource = VALLEJO_MODEL_COLORS;
        } else if (source === 'vallejo_model_air_colours' || source === 'vallejoair') {
            if (typeof VALLEJO_MODEL_AIR_COLORS === 'undefined' || !VALLEJO_MODEL_AIR_COLORS || VALLEJO_MODEL_AIR_COLORS.length === 0) {
                return null;
            }
            dataSource = VALLEJO_MODEL_AIR_COLORS;
        } else if (source === 'army_painter_speedpaint_2.0') {
            if (typeof ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS === 'undefined' || !ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS || ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS.length === 0) {
                return null;
            }
            dataSource = ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS;
        } else if (source === 'army_painter_warpaints_fanatic') {
            if (typeof ARMY_PAINTER_WARPANTS_FANATIC_COLOURS === 'undefined' || !ARMY_PAINTER_WARPANTS_FANATIC_COLOURS || ARMY_PAINTER_WARPANTS_FANATIC_COLOURS.length === 0) {
                return null;
            }
            dataSource = ARMY_PAINTER_WARPANTS_FANATIC_COLOURS;
        } else if (source === 'ak_interactive_3gen') {
            if (typeof AK_INTERACTIVE_3GEN_DATA === 'undefined' || !AK_INTERACTIVE_3GEN_DATA || AK_INTERACTIVE_3GEN_DATA.length === 0) {
                return null;
            }
            dataSource = AK_INTERACTIVE_3GEN_DATA;
        } else if (source === 'ak_interactive_quick_gen') {
            if (typeof AK_INTERACTIVE_QUICK_GEN === 'undefined' || !AK_INTERACTIVE_QUICK_GEN || AK_INTERACTIVE_QUICK_GEN.length === 0) {
                return null;
            }
            dataSource = AK_INTERACTIVE_QUICK_GEN;
        } else {
            return null;
        }
    }

    // Convert target color to HSV
    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (saturationThreshold / 100);

    let closestMatch = null;
    let minDistance = Infinity;

    // First pass: try to find match with saturation filter
    dataSource.forEach(item => {
        // Convert hex to RGB
        const hex = item.hex.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Convert candidate color to HSV
        const candidateHSV = rgbToHSV(r, g, b);
        
        // Ignore colors with saturation less than threshold percentage of target saturation
        if (candidateHSV.s < thresholdValue) {
            return; // Skip this color
        }

        // Calculate distance in HSV color space
        const distance = hsvDistance(targetHSV, candidateHSV);

        if (distance < minDistance) {
            minDistance = distance;
            closestMatch = item;
        }
    });

    // If no match found with saturation filter, try without filter
    if (closestMatch === null) {
        minDistance = Infinity;
        
        dataSource.forEach(item => {
            // Convert hex to RGB
            const hex = item.hex.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            // Convert candidate color to HSV
            const candidateHSV = rgbToHSV(r, g, b);

            // Calculate distance in HSV color space
            const distance = hsvDistance(targetHSV, candidateHSV);

            if (distance < minDistance) {
                minDistance = distance;
                closestMatch = item;
            }
        });
    }

    return closestMatch;
}

// Find Nth closest color (1 = closest, 2 = second closest, etc.)
function findNthClosestColor(targetColor, n, source = 'merged', filterContainerId = null) {
    let dataSource = null;
    
    // Use merged data source
    if (source === 'merged' || !source) {
        if (!mergedPaintColors || mergedPaintColors.length === 0) {
            return null;
        }
        dataSource = mergedPaintColors;
        
        // Apply filters if filter container ID is provided
        if (filterContainerId) {
            dataSource = filterData(dataSource, filterContainerId);
        }
    } else {
        // Legacy support for old source names (for backward compatibility)
        if (source === 'vallejo_model_colours' || source === 'vallejo') {
            if (typeof VALLEJO_MODEL_COLORS === 'undefined' || !VALLEJO_MODEL_COLORS || VALLEJO_MODEL_COLORS.length === 0) {
                return null;
            }
            dataSource = VALLEJO_MODEL_COLORS;
        } else if (source === 'vallejo_model_air_colours' || source === 'vallejoair') {
            if (typeof VALLEJO_MODEL_AIR_COLORS === 'undefined' || !VALLEJO_MODEL_AIR_COLORS || VALLEJO_MODEL_AIR_COLORS.length === 0) {
                return null;
            }
            dataSource = VALLEJO_MODEL_AIR_COLORS;
        } else if (source === 'army_painter_speedpaint_2.0') {
            if (typeof ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS === 'undefined' || !ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS || ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS.length === 0) {
                return null;
            }
            dataSource = ARMY_PAINTER_SPEEDPAINT_2_0_COLOURS;
        } else if (source === 'army_painter_warpaints_fanatic') {
            if (typeof ARMY_PAINTER_WARPANTS_FANATIC_COLOURS === 'undefined' || !ARMY_PAINTER_WARPANTS_FANATIC_COLOURS || ARMY_PAINTER_WARPANTS_FANATIC_COLOURS.length === 0) {
                return null;
            }
            dataSource = ARMY_PAINTER_WARPANTS_FANATIC_COLOURS;
        } else if (source === 'ak_interactive_3gen') {
            if (typeof AK_INTERACTIVE_3GEN_DATA === 'undefined' || !AK_INTERACTIVE_3GEN_DATA || AK_INTERACTIVE_3GEN_DATA.length === 0) {
                return null;
            }
            dataSource = AK_INTERACTIVE_3GEN_DATA;
        } else if (source === 'ak_interactive_quick_gen') {
            if (typeof AK_INTERACTIVE_QUICK_GEN === 'undefined' || !AK_INTERACTIVE_QUICK_GEN || AK_INTERACTIVE_QUICK_GEN.length === 0) {
                return null;
            }
            dataSource = AK_INTERACTIVE_QUICK_GEN;
        } else {
            return null;
        }
    }

    // Convert target color to HSV
    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (saturationThreshold / 100);

    // Collect all matches with their distances
    const matches = [];
    
    // First pass: try to find matches with saturation filter
    dataSource.forEach(item => {
        // Convert hex to RGB
        const hex = item.hex.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Convert candidate color to HSV
        const candidateHSV = rgbToHSV(r, g, b);
        
        // Ignore colors with saturation less than threshold percentage of target saturation
        if (candidateHSV.s < thresholdValue) {
            return; // Skip this color
        }

        // Calculate distance in HSV color space
        const distance = hsvDistance(targetHSV, candidateHSV);
        matches.push({ item, distance });
    });

    // If no matches found with saturation filter, try without filter
    if (matches.length === 0) {
        dataSource.forEach(item => {
            // Convert hex to RGB
            const hex = item.hex.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            // Convert candidate color to HSV
            const candidateHSV = rgbToHSV(r, g, b);

            // Calculate distance in HSV color space
            const distance = hsvDistance(targetHSV, candidateHSV);
            matches.push({ item, distance });
        });
    }

    // Sort by distance and return the Nth closest
    matches.sort((a, b) => a.distance - b.distance);
    
    if (matches.length >= n) {
        return matches[n - 1].item;
    }
    
    return null;
}

// Find closest color from myCollection
function findClosestFromMyCollection(targetColor, filterContainerId = null) {
    if (!myCollection || myCollection.length === 0) {
        return null;
    }

    // Apply filters if filter container ID is provided
    let dataSource = myCollection;
    if (filterContainerId) {
        dataSource = filterData(myCollection, filterContainerId);
        if (dataSource.length === 0) {
            return null;
        }
    }

    // Convert target color to HSV
    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (saturationThreshold / 100);

    let closestMatch = null;
    let minDistance = Infinity;

    // First pass: try to find match with saturation filter
    dataSource.forEach(item => {
        // Convert hex to RGB
        const hex = item.hex.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Convert candidate color to HSV
        const candidateHSV = rgbToHSV(r, g, b);
        
        // Ignore colors with saturation less than threshold percentage of target saturation
        if (candidateHSV.s < thresholdValue) {
            return; // Skip this color
        }

        // Calculate distance in HSV color space
        const distance = hsvDistance(targetHSV, candidateHSV);

        if (distance < minDistance) {
            minDistance = distance;
            closestMatch = item;
        }
    });

    // If no match found with saturation filter, try without filter
    if (closestMatch === null) {
        minDistance = Infinity;
        
        dataSource.forEach(item => {
            // Convert hex to RGB
            const hex = item.hex.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            // Convert candidate color to HSV
            const candidateHSV = rgbToHSV(r, g, b);

            // Calculate distance in HSV color space
            const distance = hsvDistance(targetHSV, candidateHSV);

            if (distance < minDistance) {
                minDistance = distance;
                closestMatch = item;
            }
        });
    }

    return closestMatch;
}

// Find Nth closest color from My Collection
function findNthClosestFromMyCollection(targetColor, n, filterContainerId = null) {
    if (!myCollection || myCollection.length === 0) {
        return null;
    }

    // Apply filters if filter container ID is provided
    let dataSource = myCollection;
    if (filterContainerId) {
        dataSource = filterData(myCollection, filterContainerId);
        if (dataSource.length === 0) {
            return null;
        }
    }

    // Convert target color to HSV
    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (saturationThreshold / 100);

    // Collect all matches with their distances
    const matches = [];
    
    // First pass: try to find matches with saturation filter
    dataSource.forEach(item => {
        // Convert hex to RGB
        const hex = item.hex.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Convert candidate color to HSV
        const candidateHSV = rgbToHSV(r, g, b);
        
        // Ignore colors with saturation less than threshold percentage of target saturation
        if (candidateHSV.s < thresholdValue) {
            return; // Skip this color
        }

        // Calculate distance in HSV color space
        const distance = hsvDistance(targetHSV, candidateHSV);
        matches.push({ item, distance });
    });

    // If no matches found with saturation filter, try without filter
    if (matches.length === 0) {
        dataSource.forEach(item => {
            // Convert hex to RGB
            const hex = item.hex.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            // Convert candidate color to HSV
            const candidateHSV = rgbToHSV(r, g, b);

            // Calculate distance in HSV color space
            const distance = hsvDistance(targetHSV, candidateHSV);
            matches.push({ item, distance });
        });
    }

    // Sort by distance and return the Nth closest
    matches.sort((a, b) => a.distance - b.distance);
    return matches.length >= n ? matches[n - 1].item : null;
}

// Find closest color from palette
function findClosestFromPalette(targetColor) {
    if (!palette || palette.length === 0) {
        return null;
    }

    // Convert target color to HSV
    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (saturationThreshold / 100);

    let closestMatch = null;
    let minDistance = Infinity;

    // First pass: try to find match with saturation filter
    palette.forEach(item => {
        // Convert hex to RGB if needed
        let r, g, b;
        if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
            r = item.r;
            g = item.g;
            b = item.b;
        } else {
            const hex = item.hex.replace('#', '');
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        }

        // Convert candidate color to HSV
        const candidateHSV = rgbToHSV(r, g, b);
        
        // Ignore colors with saturation less than threshold percentage of target saturation
        if (candidateHSV.s < thresholdValue) {
            return; // Skip this color
        }

        // Calculate distance in HSV color space
        const distance = hsvDistance(targetHSV, candidateHSV);

        if (distance < minDistance) {
            minDistance = distance;
            closestMatch = item;
        }
    });

    // If no match found with saturation filter, try without filter
    if (closestMatch === null) {
        minDistance = Infinity;
        
        palette.forEach(item => {
            // Convert hex to RGB if needed
            let r, g, b;
            if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
                r = item.r;
                g = item.g;
                b = item.b;
            } else {
                const hex = item.hex.replace('#', '');
                r = parseInt(hex.substr(0, 2), 16);
                g = parseInt(hex.substr(2, 2), 16);
                b = parseInt(hex.substr(4, 2), 16);
            }

            // Convert candidate color to HSV
            const candidateHSV = rgbToHSV(r, g, b);

            // Calculate distance in HSV color space
            const distance = hsvDistance(targetHSV, candidateHSV);

            if (distance < minDistance) {
                minDistance = distance;
                closestMatch = item;
            }
        });
    }

    return closestMatch;
}

// Find Nth closest color from palette
function findNthClosestFromPalette(targetColor, n) {
    if (!palette || palette.length === 0) {
        return null;
    }

    // Convert target color to HSV
    const targetHSV = rgbToHSV(targetColor.r, targetColor.g, targetColor.b);
    const targetSaturation = targetHSV.s;
    const thresholdValue = targetSaturation * (saturationThreshold / 100);

    // Collect all matches with their distances
    const matches = [];
    
    // First pass: try to find matches with saturation filter
    palette.forEach(item => {
        // Convert hex to RGB if needed
        let r, g, b;
        if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
            r = item.r;
            g = item.g;
            b = item.b;
        } else {
            const hex = item.hex.replace('#', '');
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        }

        // Convert candidate color to HSV
        const candidateHSV = rgbToHSV(r, g, b);
        
        // Ignore colors with saturation less than threshold percentage of target saturation
        if (candidateHSV.s < thresholdValue) {
            return; // Skip this color
        }

        // Calculate distance in HSV color space
        const distance = hsvDistance(targetHSV, candidateHSV);
        matches.push({ item, distance });
    });

    // If no matches found with saturation filter, try without filter
    if (matches.length === 0) {
        palette.forEach(item => {
            // Convert hex to RGB if needed
            let r, g, b;
            if (item.r !== undefined && item.g !== undefined && item.b !== undefined) {
                r = item.r;
                g = item.g;
                b = item.b;
            } else {
                const hex = item.hex.replace('#', '');
                r = parseInt(hex.substr(0, 2), 16);
                g = parseInt(hex.substr(2, 2), 16);
                b = parseInt(hex.substr(4, 2), 16);
            }

            // Convert candidate color to HSV
            const candidateHSV = rgbToHSV(r, g, b);

            // Calculate distance in HSV color space
            const distance = hsvDistance(targetHSV, candidateHSV);
            matches.push({ item, distance });
        });
    }

    // Sort by distance and return the Nth closest
    matches.sort((a, b) => a.distance - b.distance);
    return matches.length >= n ? matches[n - 1].item : null;
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
            cell.colSpan = 4;
            cell.textContent = 'No colors in palette yet. Add colors from the Color Picker tab.';
            row.appendChild(cell);
            tbody.appendChild(row);
            updateHeaderCount('planningHeader', 0, 0);
            return;
        }
        
        // Don't filter the palette - filters apply to candidates (merged data source and my collection)
        // Update header count (show all palette colors)
        updateHeaderCount('planningHeader', palette.length, palette.length);

        palette.forEach(color => {
            const row = document.createElement('tr');
            
            // Colour column
            const colorCell = document.createElement('td');
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = color.hex;
            addGradientClickToColorBox(colorBox, color.hex);
            colorCell.appendChild(colorBox);
            row.appendChild(colorCell);
            
            // Candidate column
            const candidateCell = document.createElement('td');
            const closestMatch = findClosestColor(color, 'merged', 'planningFilters');
            
            if (closestMatch) {
                const candidateColorBox = document.createElement('div');
                candidateColorBox.className = 'color-box';
                candidateColorBox.style.backgroundColor = closestMatch.hex;
                addGradientClickToColorBox(candidateColorBox, closestMatch.hex);
                
                // Store color data for tooltip
                candidateColorBox.dataset.colorName = closestMatch.name || '';
                candidateColorBox.dataset.colorType = Array.isArray(closestMatch.type) ? closestMatch.type.join(', ') : (closestMatch.type || '');
                candidateColorBox.dataset.colorProducer = closestMatch.producer || '';
                // Add hover tooltip
                addHoverTooltipToColorBox(candidateColorBox);
                
                const candidateName = document.createElement('span');
                candidateName.className = 'candidate-name';
                
                // Use name from merged data (already formatted)
                candidateName.textContent = closestMatch.name || '';
                
                const candidateContainer = document.createElement('div');
                candidateContainer.className = 'candidate-container';
                candidateContainer.appendChild(candidateColorBox);
                
                const candidateNameWrapper = document.createElement('div');
                candidateNameWrapper.className = 'candidate-name-wrapper';
                candidateNameWrapper.appendChild(candidateName);
                
                // Add type row
                if (closestMatch.type && Array.isArray(closestMatch.type) && closestMatch.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = closestMatch.type.join(', ');
                    candidateNameWrapper.appendChild(typeSpan);
                }
                
                candidateContainer.appendChild(candidateNameWrapper);
                candidateCell.appendChild(candidateContainer);
            } else {
                candidateCell.textContent = 'No match found';
            }
            
            row.appendChild(candidateCell);
            
            // Second Candidate column
            const secondCandidateCell = document.createElement('td');
            const secondClosestMatch = findNthClosestColor(color, 2, 'merged', 'planningFilters');
            
            if (secondClosestMatch) {
                const secondCandidateColorBox = document.createElement('div');
                secondCandidateColorBox.className = 'color-box';
                secondCandidateColorBox.style.backgroundColor = secondClosestMatch.hex;
                addGradientClickToColorBox(secondCandidateColorBox, secondClosestMatch.hex);
                
                // Store color data for tooltip
                secondCandidateColorBox.dataset.colorName = secondClosestMatch.name || '';
                secondCandidateColorBox.dataset.colorType = Array.isArray(secondClosestMatch.type) ? secondClosestMatch.type.join(', ') : (secondClosestMatch.type || '');
                secondCandidateColorBox.dataset.colorProducer = secondClosestMatch.producer || '';
                // Add hover tooltip
                addHoverTooltipToColorBox(secondCandidateColorBox);
                
                const secondCandidateName = document.createElement('span');
                secondCandidateName.className = 'candidate-name';
                
                // Use name from merged data (already formatted)
                secondCandidateName.textContent = secondClosestMatch.name || '';
                
                const secondCandidateContainer = document.createElement('div');
                secondCandidateContainer.className = 'candidate-container';
                secondCandidateContainer.appendChild(secondCandidateColorBox);
                
                const secondCandidateNameWrapper = document.createElement('div');
                secondCandidateNameWrapper.className = 'candidate-name-wrapper';
                secondCandidateNameWrapper.appendChild(secondCandidateName);
                
                // Add type row
                if (secondClosestMatch.type && Array.isArray(secondClosestMatch.type) && secondClosestMatch.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = secondClosestMatch.type.join(', ');
                    secondCandidateNameWrapper.appendChild(typeSpan);
                }
                
                secondCandidateContainer.appendChild(secondCandidateNameWrapper);
                secondCandidateCell.appendChild(secondCandidateContainer);
            } else {
                secondCandidateCell.textContent = 'No match found';
            }
            
            row.appendChild(secondCandidateCell);
            
            // Closest from My Collection column
            const myCollectionCandidateCell = document.createElement('td');
            const myCollectionMatch = findClosestFromMyCollection(color, 'planningFilters');
            
            if (myCollectionMatch) {
                const myCollectionColorBox = document.createElement('div');
                myCollectionColorBox.className = 'color-box';
                myCollectionColorBox.style.backgroundColor = myCollectionMatch.hex;
                addGradientClickToColorBox(myCollectionColorBox, myCollectionMatch.hex);
                
                // Store color data for tooltip
                myCollectionColorBox.dataset.colorName = myCollectionMatch.name || '';
                myCollectionColorBox.dataset.colorType = Array.isArray(myCollectionMatch.type) ? myCollectionMatch.type.join(', ') : (myCollectionMatch.type || '');
                myCollectionColorBox.dataset.colorProducer = myCollectionMatch.producer || '';
                // Add hover tooltip
                addHoverTooltipToColorBox(myCollectionColorBox);
                
                const myCollectionName = document.createElement('span');
                myCollectionName.className = 'candidate-name';
                myCollectionName.textContent = myCollectionMatch.name || 'Unnamed';
                
                const myCollectionContainer = document.createElement('div');
                myCollectionContainer.className = 'candidate-container';
                myCollectionContainer.appendChild(myCollectionColorBox);
                
                const myCollectionNameWrapper = document.createElement('div');
                myCollectionNameWrapper.className = 'candidate-name-wrapper';
                myCollectionNameWrapper.appendChild(myCollectionName);
                
                // Add type row
                if (myCollectionMatch.type && Array.isArray(myCollectionMatch.type) && myCollectionMatch.type.length > 0) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'paint-type';
                    typeSpan.textContent = myCollectionMatch.type.join(', ');
                    myCollectionNameWrapper.appendChild(typeSpan);
                }
                
                myCollectionContainer.appendChild(myCollectionNameWrapper);
                myCollectionCandidateCell.appendChild(myCollectionContainer);
            } else {
                myCollectionCandidateCell.textContent = 'No match found';
            }
            
            row.appendChild(myCollectionCandidateCell);
            tbody.appendChild(row);
        });
    }

    // Initial load
    updatePlanningTable();

    // Update when palette changes - we'll need to call this from saveColorToPalette
    // Store the update function globally so it can be called
    window.updatePlanningTable = updatePlanningTable;
}

// Initialize sort order dropdown
function initSortOrder() {
    const sortOrderSelect = document.getElementById('sortOrderSelect');
    const sortOrderSelectPlanning = document.getElementById('sortOrderSelectPlanning');
    
    // Function to handle sort order change
    const handleSortOrderChange = (newSortOrder) => {
        sortOrder = newSortOrder;
        localStorage.setItem('colorSortOrder', sortOrder);
        
        // Update both dropdowns to stay in sync
        if (sortOrderSelect) {
            sortOrderSelect.value = sortOrder;
        }
        if (sortOrderSelectPlanning) {
            sortOrderSelectPlanning.value = sortOrder;
        }
        
        // Re-sort the palette with the new order
        palette = sortPaletteByHSV(palette, sortOrder);
        savePalette();
        loadPalette();
        
        // Update planning table
        if (window.updatePlanningTable) {
            window.updatePlanningTable();
        }
        
        // Update color wheel
        if (colorWheelCanvas) {
            drawPalettePointsOnWheel();
        }
    };

    // Set the saved sort order for both dropdowns
    if (sortOrderSelect) {
        sortOrderSelect.value = sortOrder;
        sortOrderSelect.addEventListener('change', (e) => {
            handleSortOrderChange(e.target.value);
        });
    }

    if (sortOrderSelectPlanning) {
        sortOrderSelectPlanning.value = sortOrder;
        sortOrderSelectPlanning.addEventListener('change', (e) => {
            handleSortOrderChange(e.target.value);
        });
    }
}

// Initialize candidate source dropdown
// Get display name for source
function getSourceDisplayName(source) {
    const sourceNames = {
        'merged': 'Merged (All Sources)',
        'vallejo_model_colours': 'Vallejo Model',
        'vallejo_model_air_colours': 'Vallejo Model Air',
        'army_painter_speedpaint_2.0': 'Army Painter Speedpaint 2.0',
        'army_painter_warpaints_fanatic': 'Army Painter Warpaints Fanatic',
        'ak_interactive_3gen': 'AK Interactive 3rd Gen',
        'ak_interactive_quick_gen': 'AK Interactive Quick Gen'
    };
    return sourceNames[source] || 'Merged (All Sources)';
}

// Initialize source selection modal and buttons


// Initialize saturation threshold input
function initSaturationThreshold() {
    const saturationThresholdInput = document.getElementById('saturationThreshold');
    if (!saturationThresholdInput) return;

    // Set the saved threshold value
    saturationThresholdInput.value = saturationThreshold;

    // Add event listener for changes
    saturationThresholdInput.addEventListener('change', (e) => {
        const newThreshold = parseFloat(e.target.value);
        if (!isNaN(newThreshold) && newThreshold >= 0 && newThreshold <= 100) {
            saturationThreshold = newThreshold;
            localStorage.setItem('saturationThreshold', saturationThreshold);
            
            // Update planning table with new threshold
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        }
    });

    // Also update on input for real-time feedback
    saturationThresholdInput.addEventListener('input', (e) => {
        const newThreshold = parseFloat(e.target.value);
        if (!isNaN(newThreshold) && newThreshold >= 0 && newThreshold <= 100) {
            saturationThreshold = newThreshold;
            localStorage.setItem('saturationThreshold', saturationThreshold);
            
            // Update planning table with new threshold
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        }
    });
}

// Initialize filter toggle button for Selected Color section
function initSelectedColorFilterToggle() {
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

// Initialize color wheel sliders
function initColorWheelSliders() {
    // Palette wheel sliders
    const paletteValueSlider = document.getElementById('paletteValueSlider');
    const paletteValueDisplay = document.getElementById('paletteValueDisplay');
    const paletteRangeSlider = document.getElementById('paletteRangeSlider');
    const paletteRangeDisplay = document.getElementById('paletteRangeDisplay');
    
    if (paletteValueSlider && paletteValueDisplay && paletteRangeSlider && paletteRangeDisplay) {
        // Set initial values from state
        paletteValueSlider.value = paletteValueMiddle;
        paletteValueDisplay.textContent = Math.round(paletteValueMiddle);
        paletteRangeSlider.value = paletteValueRange;
        paletteRangeDisplay.textContent = Math.round(paletteValueRange);
        
        // Value slider handler
        paletteValueSlider.addEventListener('input', (e) => {
            paletteValueMiddle = parseFloat(e.target.value);
            paletteValueDisplay.textContent = Math.round(paletteValueMiddle);
            localStorage.setItem('paletteValueMiddle', paletteValueMiddle);
            drawPalettePointsOnWheel();
        });
        
        // Range slider handler
        paletteRangeSlider.addEventListener('input', (e) => {
            paletteValueRange = parseFloat(e.target.value);
            paletteRangeDisplay.textContent = Math.round(paletteValueRange);
            localStorage.setItem('paletteValueRange', paletteValueRange);
            drawPalettePointsOnWheel();
        });
    }
    
    // Collection wheel sliders
    const collectionValueSlider = document.getElementById('collectionValueSlider');
    const collectionValueDisplay = document.getElementById('collectionValueDisplay');
    const collectionRangeSlider = document.getElementById('collectionRangeSlider');
    const collectionRangeDisplay = document.getElementById('collectionRangeDisplay');
    
    if (collectionValueSlider && collectionValueDisplay && collectionRangeSlider && collectionRangeDisplay) {
        // Set initial values from state
        collectionValueSlider.value = collectionValueMiddle;
        collectionValueDisplay.textContent = Math.round(collectionValueMiddle);
        collectionRangeSlider.value = collectionValueRange;
        collectionRangeDisplay.textContent = Math.round(collectionValueRange);
        
        // Value slider handler
        collectionValueSlider.addEventListener('input', (e) => {
            collectionValueMiddle = parseFloat(e.target.value);
            collectionValueDisplay.textContent = Math.round(collectionValueMiddle);
            localStorage.setItem('collectionValueMiddle', collectionValueMiddle);
            drawCollectionPointsOnWheel();
        });
        
        // Range slider handler
        collectionRangeSlider.addEventListener('input', (e) => {
            collectionValueRange = parseFloat(e.target.value);
            collectionRangeDisplay.textContent = Math.round(collectionValueRange);
            localStorage.setItem('collectionValueRange', collectionValueRange);
            drawCollectionPointsOnWheel();
        });
    }
}

// Add hover tooltip to color box showing name, type, and producer
function addHoverTooltipToColorBox(colorBox) {
    // Remove existing tooltip and event listeners
    const existingTooltip = colorBox.querySelector('.color-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    // Check if tooltip handlers are already attached
    if (colorBox.dataset.tooltipAttached === 'true') {
        return; // Already has tooltip handlers
    }
    
    // Get the color data
    const name = colorBox.dataset.colorName;
    const type = colorBox.dataset.colorType;
    const producer = colorBox.dataset.colorProducer;
    
    if (!name && !type && !producer) return;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'color-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-name">${name || 'N/A'}</div>
        <div class="tooltip-type">Type: ${type || 'N/A'}</div>
        <div class="tooltip-producer">Producer: ${producer || 'N/A'}</div>
    `;
    colorBox.appendChild(tooltip);
    
    // Mark as attached
    colorBox.dataset.tooltipAttached = 'true';
    
    // Show tooltip on hover
    colorBox.addEventListener('mouseenter', function showTooltip() {
        tooltip.style.display = 'block';
    });
    
    // Hide tooltip on mouse leave
    colorBox.addEventListener('mouseleave', function hideTooltip() {
        tooltip.style.display = 'none';
    });
}

// Add Color Modal Functionality
const addColorBtn = document.getElementById('addColorBtn');
const addColorModal = document.getElementById('addColorModal');
const addColorModalClose = document.getElementById('addColorModalClose');
const addColorForm = document.getElementById('addColorForm');
const cancelAddColorBtn = document.getElementById('cancelAddColorBtn');
const colorHex = document.getElementById('colorHex');
const colorHexPicker = document.getElementById('colorHexPicker');

// Open modal when Add Color button is clicked
if (addColorBtn) {
    addColorBtn.addEventListener('click', () => {
        if (addColorModal) {
            addColorModal.style.display = 'block';
            // Reset form
            if (addColorForm) {
                addColorForm.reset();
                // Set default hex to white
                colorHex.value = '#FFFFFF';
                colorHexPicker.value = '#FFFFFF';
            }
        }
    });
}

// Close modal when X button is clicked
if (addColorModalClose) {
    addColorModalClose.addEventListener('click', () => {
        if (addColorModal) {
            addColorModal.style.display = 'none';
        }
    });
}

// Close modal when Cancel button is clicked
if (cancelAddColorBtn) {
    cancelAddColorBtn.addEventListener('click', () => {
        if (addColorModal) {
            addColorModal.style.display = 'none';
        }
    });
}

// Close modal when clicking outside of it
if (addColorModal) {
    addColorModal.addEventListener('click', (e) => {
        if (e.target === addColorModal) {
            addColorModal.style.display = 'none';
        }
    });
}

// Sync color picker with hex input
if (colorHexPicker && colorHex) {
    colorHexPicker.addEventListener('input', (e) => {
        colorHex.value = e.target.value.toUpperCase();
    });
    
    colorHex.addEventListener('input', (e) => {
        let hexValue = e.target.value.replace(/[^0-9A-Fa-f]/g, ''); // Remove non-hex characters
        // Limit to 6 characters
        if (hexValue.length > 6) {
            hexValue = hexValue.substring(0, 6);
        }
        // Add # prefix
        hexValue = '#' + hexValue;
        e.target.value = hexValue.toUpperCase();
        
        // Update color picker if valid
        if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
            colorHexPicker.value = hexValue;
        }
    });
    
    // Handle paste events
    colorHex.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        let hexValue = pastedText.replace(/[^0-9A-Fa-f]/g, ''); // Remove non-hex characters
        if (hexValue.length > 6) {
            hexValue = hexValue.substring(0, 6);
        }
        hexValue = '#' + hexValue;
        colorHex.value = hexValue.toUpperCase();
        if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
            colorHexPicker.value = hexValue;
        }
    });
}

// Handle form submission
if (addColorForm) {
    addColorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('colorName').value.trim();
        let hex = document.getElementById('colorHex').value.trim();
        const typeStr = document.getElementById('colorType').value.trim();
        const producer = document.getElementById('colorProducer').value.trim();
        
        // Validate required fields
        if (!name) {
            alert('Please enter a color name.');
            return;
        }
        
        // Ensure hex starts with # and is uppercase
        if (!hex.startsWith('#')) {
            hex = '#' + hex;
        }
        hex = hex.toUpperCase();
        
        // Validate hex format
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            alert('Please enter a valid hex color (e.g., #FF0000).');
            return;
        }
        
        // Parse type (comma-separated string to array)
        const type = typeStr ? typeStr.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
        
        // Create color data object
        const colorData = {
            name: name,
            hex: hex,
            type: type,
            producer: producer
        };
        
        // Add to collection
        if (addToMyCollection(colorData)) {
            // Close modal
            addColorModal.style.display = 'none';
            // Reset form
            addColorForm.reset();
        } else {
            alert('This color already exists in your collection.');
        }
    });
}

