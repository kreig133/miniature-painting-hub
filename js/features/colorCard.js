/**
 * Color Card feature - generates color card with image from Palette Editor or References
 */

import { getCurrentPaletteId, getPalette, getPlanningMappings, getMyCollection, getShoppingCart } from '../core/state.js';
import { loadModelImages } from '../utils/storage.js';
import { addGradientClickToColorBox } from '../utils/colorUtils.js';
import { addHoverTooltipToColorBox } from '../utils/domUtils.js';

// Image rotation state
let leftImageRotation = 0;
let rightImageRotation = 0;

// Color box position
let colorBoxPosition = 'top';

// Color box size (slider value 0-100, maps to 5px to 50% of smallest side)
let colorBoxSizePercent = 30; // Default slider position (approximately 16% of smallest side)

// Color box padding from edge and gap between boxes
let colorBoxPadding = 8; // Padding from edge of image (in pixels)
let colorBoxGap = 8; // Gap between color boxes (in pixels)

// Right overlay edge padding (slider value 0-100, maps to 0 to 40% of smallest side, default 10%)
let rightOverlayPaddingPercent = 25; // Default slider position (10% of smallest side: 25/100 * 40% = 10%)

// Right overlay list scale (slider value 50-150, maps to 50% to 150% scale, default 100%)
let rightOverlayListScale = 100; // Default scale 100%

// Helper functions (matching planning.js)
function getAssignedPaintFromMapping(mapping) {
    if (!mapping) return null;
    return mapping.candidate1 || mapping.candidate2 || mapping.fromAll || null;
}

function isInMyCollection(paint) {
    if (!paint) return false;
    const myCollection = getMyCollection();
    return myCollection.some(c => c.hex === paint.hex && c.name === paint.name && c.producer === paint.producer);
}

function isInShoppingList(paint) {
    if (!paint) return false;
    const shoppingCart = getShoppingCart();
    return shoppingCart.some(c => c.hex === paint.hex && c.name === paint.name && c.producer === paint.producer);
}

// Get image from canvas (Palette Editor)
function getImageFromCanvas() {
    const imageCanvas = document.getElementById('imageCanvas');
    const imageSection = document.getElementById('imageSection');
    
    if (!imageCanvas || !imageSection) return null;
    
    // Check if image section is visible and canvas has content
    const isVisible = imageSection.style.display !== 'none' && 
                     window.getComputedStyle(imageSection).display !== 'none';
    
    if (!isVisible) return null;
    
    // Check if canvas has content (width and height > 0)
    if (imageCanvas.width === 0 || imageCanvas.height === 0) return null;
    
    try {
        // Convert canvas to data URL
        return imageCanvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error getting image from canvas:', error);
        return null;
    }
}

// Get first image from references
function getFirstReferenceImage() {
    const currentId = getCurrentPaletteId();
    if (!currentId) return null;
    
    const images = loadModelImages(currentId);
    if (images.length === 0) return null;
    
    // Return first image's dataUrl
    return images[0].dataUrl;
}

// Get assigned paint for a color
function getAssignedPaint(colorHex) {
    const currentId = getCurrentPaletteId();
    if (!currentId) return null;
    
    const mappings = getPlanningMappings();
    if (!mappings[currentId] || !mappings[currentId][colorHex]) {
        return null;
    }
    
    const mapping = mappings[currentId][colorHex];
    return mapping.candidate1 || mapping.candidate2 || mapping.fromAll || null;
}

// Calculate optimal image size for given rotation to maximize available space
function calculateImageSizeForRotation(container, naturalWidth, naturalHeight, rotation) {
    if (!container || naturalWidth === 0 || naturalHeight === 0) {
        return { width: 0, height: 0 };
    }
    
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // When rotated 90 or 270 degrees, width and height are swapped
    const isRotated90Or270 = (rotation % 180) === 90;
    
    // For rotated images, we need to swap container dimensions too
    // because after rotation, the image's visual dimensions will be swapped
    const containerWidthForCalc = isRotated90Or270 ? containerHeight : containerWidth;
    const containerHeightForCalc = isRotated90Or270 ? containerWidth : containerHeight;
    
    // Calculate scale to fit container while maximizing size
    const scale = Math.min(containerWidthForCalc / naturalWidth, containerHeightForCalc / naturalHeight);
    
    return {
        width: naturalWidth * scale,
        height: naturalHeight * scale
    };
}

// Apply rotation and resize image to fit container
function applyRotation(img, rotation, container) {
    if (!img || !container) return;
    
    // Wait for image to load
    if (!img.complete || img.naturalWidth === 0) {
        img.onload = () => applyRotation(img, rotation, container);
        return;
    }
    
    // Use requestAnimationFrame to ensure container dimensions are available
    requestAnimationFrame(() => {
        // Calculate optimal size for this rotation to maximize available space
        const size = calculateImageSizeForRotation(
            container, 
            img.naturalWidth, 
            img.naturalHeight, 
            rotation
        );
        
        // Apply the size and rotation
        img.style.width = `${size.width}px`;
        img.style.height = `${size.height}px`;
        img.style.transform = `rotate(${rotation}deg)`;
    });
}

// Rotate image 90 degrees
function rotateImage(side) {
    if (side === 'left') {
        leftImageRotation = (leftImageRotation + 90) % 360;
        const img = document.getElementById('colorCardImageLeft');
        const container = document.getElementById('colorCardImageContainerLeft');
        if (img && container) {
            applyRotation(img, leftImageRotation, container);
            // Update overlay after rotation and resize
            setTimeout(() => {
                updateColorBoxesOverlay();
            }, 100);
        }
    } else {
        rightImageRotation = (rightImageRotation + 90) % 360;
        const img = document.getElementById('colorCardImageRight');
        const container = document.getElementById('colorCardImageContainerRight');
        if (img && container) {
            applyRotation(img, rightImageRotation, container);
            // Update overlay after rotation and resize
            setTimeout(() => {
                updateRightOverlay();
            }, 100);
        }
    }
}

// Update color boxes overlay
function updateColorBoxesOverlay() {
    const overlay = document.getElementById('colorBoxesOverlay');
    const container = document.getElementById('colorCardImageContainerLeft');
    const img = document.getElementById('colorCardImageLeft');
    
    if (!overlay || !container || !img) return;
    
    const palette = getPalette();
    if (!palette || palette.length === 0) {
        overlay.innerHTML = '';
        return;
    }
    
    // Clear overlay
    overlay.innerHTML = '';
    overlay.className = `color-boxes-overlay color-boxes-${colorBoxPosition}`;
    
    // Wait for image to load to get its dimensions
    if (!img.complete || img.naturalWidth === 0) {
        img.onload = () => updateColorBoxesOverlay();
        return;
    }
    
    // Get image dimensions (accounting for rotation)
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calculate position based on image bounds within container
    const imgLeft = (containerRect.width - imgRect.width) / 2;
    const imgTop = (containerRect.height - imgRect.height) / 2;
    const imgRight = imgLeft + imgRect.width;
    const imgBottom = imgTop + imgRect.height;
    
    // Position overlay to stick to image border and span full width/height
    // Reset all positioning properties
    overlay.style.top = '';
    overlay.style.bottom = '';
    overlay.style.left = '';
    overlay.style.right = '';
    overlay.style.width = '';
    overlay.style.height = '';
    overlay.style.transform = '';
    
    // Calculate padding based on largest side (0-100 maps to 0px to 40% of largest side)
    const largestSide = Math.max(imgRect.width, imgRect.height);
    const maxPadding = largestSide * 0.4;
    const padding = (colorBoxPadding / 100) * maxPadding;
    
    switch (colorBoxPosition) {
        case 'top':
            overlay.style.top = `${imgTop + padding}px`;
            overlay.style.left = `${imgLeft}px`;
            overlay.style.width = `${imgRect.width}px`;
            overlay.style.height = 'auto';
            break;
        case 'bottom':
            overlay.style.bottom = `${containerRect.height - imgBottom + padding}px`;
            overlay.style.left = `${imgLeft}px`;
            overlay.style.width = `${imgRect.width}px`;
            overlay.style.height = 'auto';
            break;
        case 'left':
            overlay.style.top = `${imgTop}px`;
            overlay.style.left = `${imgLeft + padding}px`;
            overlay.style.width = 'auto';
            overlay.style.height = `${imgRect.height}px`;
            break;
        case 'right':
            overlay.style.top = `${imgTop}px`;
            overlay.style.right = `${containerRect.width - imgRight + padding}px`;
            overlay.style.width = 'auto';
            overlay.style.height = `${imgRect.height}px`;
            break;
    }
    
    // Calculate color box size based on smallest side of image
    // Slider range: 0-100 maps to 5px to 50% of smallest side
    const smallestSide = Math.min(imgRect.width, imgRect.height);
    const minSize = 5;
    const maxSize = smallestSide * 0.5; // 50% of smallest side
    // Map slider value (0-100) to size range (5px to 50% of smallest side)
    const boxSize = minSize + (colorBoxSizePercent / 100) * (maxSize - minSize);
    
    // Calculate gap based on largest side (0-100 maps to 0px to 40% of largest side)
    const maxGap = largestSide * 0.4;
    const gap = (colorBoxGap / 100) * maxGap;
    
    // Create color boxes
    const boxesContainer = document.createElement('div');
    boxesContainer.className = 'color-boxes-container';
    boxesContainer.style.gap = `${gap}px`; // Set gap dynamically
    
    // Set container dimensions to fit within image bounds with padding
    // Padding is applied on all sides except the opposing side
    if (colorBoxPosition === 'top' || colorBoxPosition === 'bottom') {
        // Horizontal layout: center vertically, stick to sides horizontally
        boxesContainer.style.width = `${imgRect.width}px`;
        boxesContainer.style.height = 'auto';
        boxesContainer.style.paddingTop = colorBoxPosition === 'top' ? '0' : `${padding}px`;
        boxesContainer.style.paddingBottom = colorBoxPosition === 'bottom' ? '0' : `${padding}px`;
        boxesContainer.style.paddingLeft = `${padding}px`;
        boxesContainer.style.paddingRight = `${padding}px`;
        boxesContainer.style.boxSizing = 'border-box';
        boxesContainer.style.justifyContent = 'center'; // Center boxes horizontally
        boxesContainer.style.alignItems = 'center'; // Center boxes vertically
    } else {
        // Vertical layout: center horizontally, stick to sides vertically
        boxesContainer.style.width = 'auto';
        boxesContainer.style.height = `${imgRect.height}px`;
        boxesContainer.style.paddingLeft = colorBoxPosition === 'left' ? '0' : `${padding}px`;
        boxesContainer.style.paddingRight = colorBoxPosition === 'right' ? '0' : `${padding}px`;
        boxesContainer.style.paddingTop = `${padding}px`;
        boxesContainer.style.paddingBottom = `${padding}px`;
        boxesContainer.style.boxSizing = 'border-box';
        boxesContainer.style.justifyContent = 'center'; // Center boxes vertically
        boxesContainer.style.alignItems = 'center'; // Center boxes horizontally
    }
    
    palette.forEach(color => {
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = color.hex;
        colorBox.style.width = `${boxSize}px`;
        colorBox.style.height = `${boxSize}px`;
        colorBox.title = color.hex;
        boxesContainer.appendChild(colorBox);
    });
    
    overlay.appendChild(boxesContainer);
}

// Update right overlay
function updateRightOverlay() {
    const overlay = document.getElementById('rightOverlay');
    const container = document.getElementById('colorCardImageContainerRight');
    const img = document.getElementById('colorCardImageRight');
    
    if (!overlay || !container || !img) return;
    
    // Wait for image to load to get its dimensions
    if (!img.complete || img.naturalWidth === 0) {
        img.onload = () => updateRightOverlay();
        return;
    }
    
    // Get image dimensions (already accounts for rotation via getBoundingClientRect)
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calculate padding based on displayed image's smallest side
    const displayedSmallestSide = Math.min(imgRect.width, imgRect.height);
    const maxPadding = displayedSmallestSide * 0.4; // 40% of smallest side
    const padding = (rightOverlayPaddingPercent / 100) * maxPadding;
    
    // Calculate overlay dimensions using displayed image size
    const overlayWidth = imgRect.width - padding * 2;
    const overlayHeight = imgRect.height - padding * 2;
    
    // Calculate position based on image center
    const imgLeft = (containerRect.width - imgRect.width) / 2;
    const imgTop = (containerRect.height - imgRect.height) / 2;
    const imgCenterX = imgLeft + imgRect.width / 2;
    const imgCenterY = imgTop + imgRect.height / 2;
    
    // Position overlay centered on image (do NOT rotate with image)
    overlay.style.position = 'absolute';
    overlay.style.width = `${overlayWidth}px`;
    overlay.style.height = `${overlayHeight}px`;
    overlay.style.top = `${imgCenterY - overlayHeight / 2}px`;
    overlay.style.left = `${imgCenterX - overlayWidth / 2}px`;
    overlay.style.zIndex = '10';
    
    // Do NOT apply rotation transform - overlay should remain unrotated
    overlay.style.transform = 'none';
    overlay.style.transformOrigin = 'center center';
    
    // Get palette and mappings
    const palette = getPalette();
    const currentId = getCurrentPaletteId();
    const mappings = getPlanningMappings();
    
    // Clear overlay content
    overlay.innerHTML = '';
    
    // Calculate scale factor (50-150% from slider value)
    const scaleFactor = rightOverlayListScale / 100;
    
    // Create list container
    const listContainer = document.createElement('div');
    listContainer.className = 'right-overlay-list';
    listContainer.style.width = '100%';
    listContainer.style.height = '100%';
    listContainer.style.overflowY = 'auto';
    listContainer.style.padding = `${10 * scaleFactor}px`;
    listContainer.style.boxSizing = 'border-box';
    listContainer.style.pointerEvents = 'auto'; // Allow interaction with list items
    
    // Add all palette colors with their mappings
    if (palette && palette.length > 0) {
        const paletteMappings = mappings && mappings[currentId] ? mappings[currentId] : {};
        
        palette.forEach(color => {
            const colorHex = color.hex;
            const mapping = paletteMappings[colorHex];
            
            const listItem = document.createElement('div');
            listItem.className = 'right-overlay-item';
            listItem.style.marginBottom = `${10 * scaleFactor}px`;
            listItem.style.padding = `${8 * scaleFactor}px`;
            listItem.style.background = 'rgba(255, 255, 255, 0.8)';
            listItem.style.borderRadius = `${6 * scaleFactor}px`;
            
            const assignedPaint = getAssignedPaintFromMapping(mapping);
            const mixingScheme = mapping?.mixingScheme;
            
            if (assignedPaint || (mixingScheme && mixingScheme.resultHex)) {
                const container = document.createElement('div');
                container.className = 'candidate-container';
                container.style.position = 'relative';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.gap = `${10 * scaleFactor}px`;
                container.style.flexWrap = 'wrap';
                container.style.alignContent = 'flex-start';
                container.style.justifyContent = 'flex-start';
                
                if (assignedPaint) {
                    // Show assigned paint
                    const paintColorBox = document.createElement('div');
                    paintColorBox.className = 'color-box';
                    paintColorBox.style.width = `${30 * scaleFactor}px`;
                    paintColorBox.style.height = `${30 * scaleFactor}px`;
                    paintColorBox.style.backgroundColor = assignedPaint.hex;
                    paintColorBox.style.position = 'relative';
                    paintColorBox.style.flexShrink = '0';
                    addGradientClickToColorBox(paintColorBox, assignedPaint.hex);
                    
                    paintColorBox.dataset.colorName = assignedPaint.name || '';
                    paintColorBox.dataset.colorType = Array.isArray(assignedPaint.type) ? assignedPaint.type.join(', ') : (assignedPaint.type || '');
                    paintColorBox.dataset.colorProducer = assignedPaint.producer || '';
                    addHoverTooltipToColorBox(paintColorBox);
                    
                    const nameWrapper = document.createElement('div');
                    nameWrapper.className = 'candidate-name-wrapper';
                    nameWrapper.style.flex = '1';
                    nameWrapper.style.minWidth = '0';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'candidate-name';
                    nameSpan.style.fontWeight = '600';
                    nameSpan.style.color = '#333';
                    nameSpan.style.display = 'block';
                    nameSpan.style.fontSize = `${0.85 * scaleFactor}rem`;
                    nameSpan.textContent = assignedPaint.name || '';
                    nameWrapper.appendChild(nameSpan);
                    
                    // Producer and type info
                    const producer = assignedPaint.producer || '';
                    const type = Array.isArray(assignedPaint.type) ? assignedPaint.type.join(', ') : (assignedPaint.type || '');
                    if (producer || type) {
                        const infoSpan = document.createElement('span');
                        infoSpan.className = 'paint-type';
                        infoSpan.style.display = 'block';
                        infoSpan.style.fontSize = `${0.75 * scaleFactor}rem`;
                        infoSpan.style.color = '#666';
                        infoSpan.textContent = producer + (producer && type ? ' • ' : '') + type;
                        nameWrapper.appendChild(infoSpan);
                    }
                    
                    container.appendChild(paintColorBox);
                    container.appendChild(nameWrapper);
                } else if (mixingScheme && mixingScheme.resultHex) {
                    // If only one color in mixing scheme, show as regular paint
                    if (mixingScheme.colors && mixingScheme.colors.length === 1) {
                        const singlePaint = mixingScheme.colors[0];
                        // Show as regular paint
                        const paintColorBox = document.createElement('div');
                        paintColorBox.className = 'color-box';
                        paintColorBox.style.width = `${30 * scaleFactor}px`;
                        paintColorBox.style.height = `${30 * scaleFactor}px`;
                        paintColorBox.style.backgroundColor = singlePaint.hex;
                        paintColorBox.style.position = 'relative';
                        paintColorBox.style.flexShrink = '0';
                        addGradientClickToColorBox(paintColorBox, singlePaint.hex);
                        
                        paintColorBox.dataset.colorName = singlePaint.name || '';
                        paintColorBox.dataset.colorType = Array.isArray(singlePaint.type) ? singlePaint.type.join(', ') : (singlePaint.type || '');
                        paintColorBox.dataset.colorProducer = singlePaint.producer || '';
                        addHoverTooltipToColorBox(paintColorBox);
                        
                        const nameWrapper = document.createElement('div');
                        nameWrapper.className = 'candidate-name-wrapper';
                        nameWrapper.style.flex = '1';
                        nameWrapper.style.minWidth = '0';
                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'candidate-name';
                        nameSpan.style.fontWeight = '600';
                        nameSpan.style.color = '#333';
                        nameSpan.style.display = 'block';
                        nameSpan.style.fontSize = `${0.85 * scaleFactor}rem`;
                        nameSpan.textContent = singlePaint.name || '';
                        nameWrapper.appendChild(nameSpan);
                        
                        // Producer and type info
                        const producer = singlePaint.producer || '';
                        const type = Array.isArray(singlePaint.type) ? singlePaint.type.join(', ') : (singlePaint.type || '');
                        if (producer || type) {
                            const infoSpan = document.createElement('span');
                            infoSpan.className = 'paint-type';
                            infoSpan.style.display = 'block';
                            infoSpan.style.fontSize = `${0.75 * scaleFactor}rem`;
                            infoSpan.style.color = '#666';
                            infoSpan.textContent = producer + (producer && type ? ' • ' : '') + type;
                            nameWrapper.appendChild(infoSpan);
                        }
                        
                        container.appendChild(paintColorBox);
                        container.appendChild(nameWrapper);
                    } else if (mixingScheme.colors && mixingScheme.colors.length > 0 && mixingScheme.coefficients) {
                        // Show mixing scheme - result color box + " = " + coeff × (color box + info) + ...
                        // Result color box
                        const resultColorBox = document.createElement('div');
                        resultColorBox.className = 'color-box';
                        resultColorBox.style.width = `${30 * scaleFactor}px`;
                        resultColorBox.style.height = `${30 * scaleFactor}px`;
                        resultColorBox.style.backgroundColor = mixingScheme.resultHex;
                        resultColorBox.style.position = 'relative';
                        resultColorBox.style.flexShrink = '0';
                        addGradientClickToColorBox(resultColorBox, mixingScheme.resultHex);
                        addHoverTooltipToColorBox(resultColorBox);
                        container.appendChild(resultColorBox);
                        // Add " = " separator
                        const equalsSpan = document.createElement('span');
                        equalsSpan.textContent = ' = ';
                        equalsSpan.style.margin = `0 ${5 * scaleFactor}px`;
                        equalsSpan.style.fontWeight = '500';
                        equalsSpan.style.fontSize = `${0.85 * scaleFactor}rem`;
                        container.appendChild(equalsSpan);
                        
                        // Add all mixing colors with their info
                        for (let i = 0; i < mixingScheme.colors.length; i++) {
                            const mixColor = mixingScheme.colors[i];
                            const coefficient = mixingScheme.coefficients[i];
                            
                            if (i > 0) {
                                const plusSpan = document.createElement('span');
                                plusSpan.textContent = ' + ';
                                plusSpan.style.margin = `0 ${5 * scaleFactor}px`;
                                plusSpan.style.fontWeight = '500';
                                plusSpan.style.fontSize = `${0.85 * scaleFactor}rem`;
                                container.appendChild(plusSpan);
                            }
                            
                            // Coefficient
                            const coeffSpan = document.createElement('span');
                            coeffSpan.textContent = `${coefficient} × `;
                            coeffSpan.style.marginRight = `${5 * scaleFactor}px`;
                            coeffSpan.style.fontWeight = '500';
                            coeffSpan.style.fontSize = `${0.85 * scaleFactor}rem`;
                            container.appendChild(coeffSpan);
                            
                            // Color box
                            const colorBox = document.createElement('div');
                            colorBox.className = 'color-box';
                            colorBox.style.width = `${30 * scaleFactor}px`;
                            colorBox.style.height = `${30 * scaleFactor}px`;
                            colorBox.style.backgroundColor = mixColor.hex;
                            colorBox.style.position = 'relative';
                            colorBox.style.flexShrink = '0';
                            addGradientClickToColorBox(colorBox, mixColor.hex);
                            colorBox.dataset.colorName = mixColor.name || '';
                            colorBox.dataset.colorType = Array.isArray(mixColor.type) ? mixColor.type.join(', ') : (mixColor.type || '');
                            colorBox.dataset.colorProducer = mixColor.producer || '';
                            addHoverTooltipToColorBox(colorBox);
                            container.appendChild(colorBox);
                            
                            // Name wrapper with paint info (similar to assigned paint)
                            const nameWrapper = document.createElement('div');
                            nameWrapper.className = 'candidate-name-wrapper';
                            nameWrapper.style.flex = '1';
                            nameWrapper.style.minWidth = '0';
                            const nameSpan = document.createElement('span');
                            nameSpan.className = 'candidate-name';
                            nameSpan.style.fontWeight = '600';
                            nameSpan.style.color = '#333';
                            nameSpan.style.display = 'block';
                            nameSpan.style.fontSize = `${0.85 * scaleFactor}rem`;
                            nameSpan.textContent = mixColor.name || '';
                            nameWrapper.appendChild(nameSpan);
                            
                            // Producer and type info
                            const producer = mixColor.producer || '';
                            const type = Array.isArray(mixColor.type) ? mixColor.type.join(', ') : (mixColor.type || '');
                            if (producer || type) {
                                const infoSpan = document.createElement('span');
                                infoSpan.className = 'paint-type';
                                infoSpan.style.display = 'block';
                                infoSpan.style.fontSize = `${0.75 * scaleFactor}rem`;
                                infoSpan.style.color = '#666';
                                infoSpan.textContent = producer + (producer && type ? ' • ' : '') + type;
                                nameWrapper.appendChild(infoSpan);
                            }
                            
                            container.appendChild(nameWrapper);
                        }
                    }
                }
                
                listItem.appendChild(container);
            } else {
                // No mapping - just show text
                listItem.style.display = 'flex';
                listItem.style.alignItems = 'center';
                listItem.style.gap = `${10 * scaleFactor}px`;
                
                const paintInfo = document.createElement('div');
                paintInfo.style.flex = '1';
                paintInfo.style.fontSize = `${0.85 * scaleFactor}rem`;
                paintInfo.style.color = '#999';
                paintInfo.textContent = 'No paint assigned';
                
                listItem.appendChild(paintInfo);
            }
            
            listContainer.appendChild(listItem);
        });
    }
    
    overlay.appendChild(listContainer);
}

// Open color card modal
function openColorCardModal() {
    const modal = document.getElementById('colorCardModal');
    const modalBody = document.getElementById('colorCardModalBody');
    
    if (!modal || !modalBody) return;
    
    // Reset rotations
    leftImageRotation = 0;
    rightImageRotation = 0;
    
    // Try to get image from canvas first
    let imageDataUrl = getImageFromCanvas();
    
    // If no canvas image, try references
    if (!imageDataUrl) {
        imageDataUrl = getFirstReferenceImage();
    }
    
    const imagesContainer = modalBody.querySelector('.color-card-images-container');
    
    // If still no image, show warning
    if (!imageDataUrl) {
        // Hide images container and show warning
        if (imagesContainer) imagesContainer.style.display = 'none';
        let warning = modalBody.querySelector('.color-card-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.className = 'color-card-warning';
            warning.innerHTML = '<p>Add some image (on Palette Editor or References tabs)</p>';
            modalBody.appendChild(warning);
        }
        warning.style.display = 'block';
        modalBody.style.padding = '30px';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Grey out other wheels
        if (window.greyOutOtherWheels) {
            window.greyOutOtherWheels();
        }
        return;
    }
    
    // Hide warning if it exists
    const warning = modalBody.querySelector('.color-card-warning');
    if (warning) {
        warning.style.display = 'none';
    }
    
    // Show images container
    if (imagesContainer) {
        imagesContainer.style.display = 'flex';
    }
    
    // Reset padding
    modalBody.style.padding = '0';
    
    // Show modal first so container dimensions are available
    modal.classList.add('active');
    
    // Update existing images
    const leftImg = document.getElementById('colorCardImageLeft');
    const rightImg = document.getElementById('colorCardImageRight');
    const leftContainer = document.getElementById('colorCardImageContainerLeft');
    const rightContainer = document.getElementById('colorCardImageContainerRight');
    
    // Use a small delay to ensure modal and containers are fully laid out
    requestAnimationFrame(() => {
        if (leftImg && leftContainer) {
            leftImg.src = imageDataUrl;
            leftImg.onload = () => {
                // Apply rotation with sizing to maximize available space
                applyRotation(leftImg, leftImageRotation, leftContainer);
                // Update overlay after image loads and is sized
                setTimeout(() => {
                    updateColorBoxesOverlay();
                }, 100);
            };
        }
        if (rightImg && rightContainer) {
            rightImg.src = imageDataUrl;
            rightImg.onload = () => {
                // Apply rotation with sizing to maximize available space
                applyRotation(rightImg, rightImageRotation, rightContainer);
                // Update overlay after image loads and is sized
                setTimeout(() => {
                    updateRightOverlay();
                }, 100);
            };
        }
    });
    
    // Setup event listeners
    setupColorCardControls();
    document.body.style.overflow = 'hidden';
    
    // Grey out other wheels
    if (window.greyOutOtherWheels) {
        window.greyOutOtherWheels();
    }
}

// Setup color card controls
function setupColorCardControls() {
    const rotateLeftBtn = document.getElementById('rotateLeftBtn');
    const rotateRightBtn = document.getElementById('rotateRightBtn');
    const positionTopBtn = document.getElementById('positionTopBtn');
    const positionLeftBtn = document.getElementById('positionLeftBtn');
    const positionBottomBtn = document.getElementById('positionBottomBtn');
    const positionRightBtn = document.getElementById('positionRightBtn');
    const sizeSlider = document.getElementById('colorBoxSizeSlider');
    const sizeValue = document.getElementById('colorBoxSizeValue');
    const paddingSlider = document.getElementById('colorBoxPaddingSlider');
    const paddingValue = document.getElementById('colorBoxPaddingValue');
    const gapSlider = document.getElementById('colorBoxGapSlider');
    const gapValue = document.getElementById('colorBoxGapValue');
    const rightOverlayPaddingSlider = document.getElementById('rightOverlayPaddingSlider');
    const rightOverlayPaddingValue = document.getElementById('rightOverlayPaddingValue');
    
    if (rotateLeftBtn) {
        rotateLeftBtn.onclick = () => {
            rotateImage('left');
        };
    }
    
    if (rotateRightBtn) {
        rotateRightBtn.onclick = () => {
            rotateImage('right');
        };
    }
    
    // Position arrow buttons
    const positionButtons = [positionTopBtn, positionLeftBtn, positionBottomBtn, positionRightBtn];
    positionButtons.forEach(btn => {
        if (btn) {
            const position = btn.getAttribute('data-position');
            btn.onclick = () => {
                colorBoxPosition = position;
                // Update active state
                positionButtons.forEach(b => {
                    if (b) b.classList.remove('active');
                });
                btn.classList.add('active');
                updateColorBoxesOverlay();
            };
            
            // Set initial active state
            if (position === colorBoxPosition) {
                btn.classList.add('active');
            }
        }
    });
    
    // Size slider (0-100 maps to 5px to 50% of smallest side)
    // Default: 16% of smallest side
    if (sizeSlider && sizeValue) {
        // Calculate default slider value for 16% of smallest side
        // Since we need to display percentage, we'll calculate it dynamically
        const updateSizeDisplay = () => {
            const leftImg = document.getElementById('colorCardImageLeft');
            if (leftImg && leftImg.complete) {
                const imgRect = leftImg.getBoundingClientRect();
                const smallestSide = Math.min(imgRect.width, imgRect.height);
                const minSize = 5;
                const maxSize = smallestSide * 0.5;
                const currentSize = minSize + (colorBoxSizePercent / 100) * (maxSize - minSize);
                const percentOfSide = (currentSize / smallestSide) * 100;
                sizeValue.textContent = `${Math.round(percentOfSide)}%`;
            } else {
                // Default display: 16%
                sizeValue.textContent = '16%';
            }
        };
        
        // Calculate slider value for 16% of side
        // For default: 16% of side = minSize + (slider/100) * (maxSize - minSize)
        // Solving for slider: slider = ((16% * side - minSize) / (maxSize - minSize)) * 100
        // But we don't know side yet, so we'll use a reasonable default
        // Since 16% is about 1/3 of 50%, we'll use ~33 as default slider position
        // Actually, let's calculate: if side = 100px, 16% = 16px
        // maxSize = 50px, minSize = 5px, so: 16 = 5 + (slider/100) * 45
        // slider = (11/45) * 100 = ~24.4
        // But this depends on image size. For a better approach, let's calculate dynamically
        // For now, set a default that approximately gives 16% for typical image sizes
        // If image is 400px, smallest side = 400px, 16% = 64px
        // 64 = 5 + (slider/100) * 195, slider = (59/195) * 100 = ~30
        // So slider value ~30 should give approximately 16% for most images
        const defaultSliderValue = 30; // Approximately 16% for typical image sizes
        sizeSlider.value = defaultSliderValue;
        colorBoxSizePercent = defaultSliderValue;
        updateSizeDisplay();
        
        sizeSlider.oninput = (e) => {
            colorBoxSizePercent = parseInt(e.target.value);
            updateSizeDisplay();
            updateColorBoxesOverlay();
        };
    }
    
    // Padding slider (0-100 maps to 0px to 40% of largest side)
    if (paddingSlider && paddingValue) {
        const updatePaddingDisplay = () => {
            const leftImg = document.getElementById('colorCardImageLeft');
            if (leftImg && leftImg.complete) {
                const imgRect = leftImg.getBoundingClientRect();
                const largestSide = Math.max(imgRect.width, imgRect.height);
                const maxPadding = largestSide * 0.4; // 40% of largest side
                const currentPadding = (colorBoxPadding / 100) * maxPadding;
                paddingValue.textContent = `${Math.round(currentPadding)}px`;
            } else {
                paddingValue.textContent = `${colorBoxPadding}px`;
            }
        };
        
        // Calculate default slider value for 8px
        // For typical image (e.g., 800px), 8px = (slider/100) * 320, slider = 2.5
        // But we'll calculate dynamically
        const defaultSliderValue = 8; // Will be recalculated based on image
        paddingSlider.value = defaultSliderValue;
        colorBoxPadding = defaultSliderValue;
        updatePaddingDisplay();
        
        paddingSlider.oninput = (e) => {
            colorBoxPadding = parseInt(e.target.value);
            updatePaddingDisplay();
            updateColorBoxesOverlay();
        };
    }
    
    // Gap slider (0-100 maps to 0px to 40% of largest side)
    if (gapSlider && gapValue) {
        const updateGapDisplay = () => {
            const leftImg = document.getElementById('colorCardImageLeft');
            if (leftImg && leftImg.complete) {
                const imgRect = leftImg.getBoundingClientRect();
                const largestSide = Math.max(imgRect.width, imgRect.height);
                const maxGap = largestSide * 0.4; // 40% of largest side
                const currentGap = (colorBoxGap / 100) * maxGap;
                gapValue.textContent = `${Math.round(currentGap)}px`;
            } else {
                gapValue.textContent = `${colorBoxGap}px`;
            }
        };
        
        // Calculate default slider value for 8px
        const defaultSliderValue = 8; // Will be recalculated based on image
        gapSlider.value = defaultSliderValue;
        colorBoxGap = defaultSliderValue;
        updateGapDisplay();
        
        gapSlider.oninput = (e) => {
            colorBoxGap = parseInt(e.target.value);
            updateGapDisplay();
            updateColorBoxesOverlay();
        };
    }
    
    // Right overlay edge padding slider (0-100 maps to 0 to 40% of smallest side, default 10%)
    if (rightOverlayPaddingSlider && rightOverlayPaddingValue) {
        const updateRightPaddingDisplay = () => {
            const rightImg = document.getElementById('colorCardImageRight');
            if (rightImg && rightImg.complete && rightImg.naturalWidth > 0) {
                // Use original image dimensions for padding calculation
                const originalWidth = rightImg.naturalWidth;
                const originalHeight = rightImg.naturalHeight;
                const originalSmallestSide = Math.min(originalWidth, originalHeight);
                const maxPadding = originalSmallestSide * 0.4;
                const padding = (rightOverlayPaddingPercent / 100) * maxPadding;
                const paddingPercent = (padding / originalSmallestSide) * 100;
                rightOverlayPaddingValue.textContent = `${paddingPercent.toFixed(1)}%`;
            }
        };
        
        rightOverlayPaddingSlider.value = rightOverlayPaddingPercent;
        updateRightPaddingDisplay();
        
        rightOverlayPaddingSlider.oninput = () => {
            rightOverlayPaddingPercent = parseInt(rightOverlayPaddingSlider.value);
            updateRightPaddingDisplay();
            updateRightOverlay();
        };
        
        // Update display when image loads/changes
        const rightImg = document.getElementById('colorCardImageRight');
        if (rightImg) {
            rightImg.onload = () => {
                setTimeout(() => {
                    updateRightPaddingDisplay();
                    updateRightOverlay();
                }, 100);
            };
        }
    }
    
    // Right overlay list scale slider (50-150%)
    const rightOverlayListScaleSlider = document.getElementById('rightOverlayListScaleSlider');
    const rightOverlayListScaleValue = document.getElementById('rightOverlayListScaleValue');
    
    if (rightOverlayListScaleSlider && rightOverlayListScaleValue) {
        rightOverlayListScaleSlider.value = rightOverlayListScale;
        rightOverlayListScaleValue.textContent = `${rightOverlayListScale}%`;
        
        rightOverlayListScaleSlider.oninput = () => {
            rightOverlayListScale = parseInt(rightOverlayListScaleSlider.value);
            rightOverlayListScaleValue.textContent = `${rightOverlayListScale}%`;
            updateRightOverlay();
        };
    }
}

// Export color card to PDF
async function exportColorCardToPDF() {
    const leftContainer = document.getElementById('colorCardImageContainerLeft');
    const rightContainer = document.getElementById('colorCardImageContainerRight');
    
    if (!leftContainer || !rightContainer) {
        alert('Cannot export: images not loaded');
        return;
    }
    
    // Disable button to prevent multiple clicks
    const printBtn = document.getElementById('colorCardPrintBtn');
    const loadingIndicator = document.getElementById('colorCardExportLoading');
    
    if (printBtn) {
        printBtn.disabled = true;
        printBtn.style.opacity = '0.5';
        printBtn.style.cursor = 'not-allowed';
    }
    
    // Show loading indicator immediately and ensure it renders
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        // Force immediate reflow to ensure the element is visible
        void loadingIndicator.offsetHeight;
    }
    
    // Use double requestAnimationFrame to ensure the loading indicator is painted
    // before starting the heavy html2canvas operations
    await new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
    
    try {
        // Check if libraries are loaded
        if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
            alert('PDF export libraries not loaded. Please refresh the page and try again.');
            if (printBtn) {
                printBtn.disabled = false;
                printBtn.style.opacity = '1';
                printBtn.style.cursor = 'pointer';
            }
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            return;
        }
        
        const { jsPDF } = window.jspdf;
        
        // Capture with optimized settings - minimal filtering
        // Since we're capturing the container directly, html2canvas will only process elements inside it
        // We just need to ensure we don't accidentally capture unwanted elements that might leak in
        const captureOptions = {
            scale: 1,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
            imageTimeout: 15000,
            removeContainer: false
        };
        
        // Capture sequentially to reduce load (was causing issues in parallel)
        const leftCanvas = await html2canvas(leftContainer, captureOptions);
        const rightCanvas = await html2canvas(rightContainer, captureOptions);
        
        // Create PDF - each image on its own page
        // Determine orientation based on image dimensions
        const leftOrientation = leftCanvas.width > leftCanvas.height ? 'landscape' : 'portrait';
        const rightOrientation = rightCanvas.width > rightCanvas.height ? 'landscape' : 'portrait';
        
        // Create PDF with first page dimensions (left image)
        const pdf = new jsPDF({
            orientation: leftOrientation,
            unit: 'px',
            format: [leftCanvas.width, leftCanvas.height]
        });
        
        // Add left image to page 1
        const leftImgData = leftCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(leftImgData, 'PNG', 0, 0, leftCanvas.width, leftCanvas.height, undefined, 'FAST');
        
        // Add new page for right image
        pdf.addPage({
            orientation: rightOrientation,
            unit: 'px',
            format: [rightCanvas.width, rightCanvas.height]
        });
        
        // Add right image to page 2
        const rightImgData = rightCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(rightImgData, 'PNG', 0, 0, rightCanvas.width, rightCanvas.height, undefined, 'FAST');
        
        // Save PDF
        pdf.save('color-card.pdf');
        
        // Hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        alert('Error exporting to PDF: ' + (error.message || 'Unknown error'));
        
        // Hide loading indicator on error
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    } finally {
        // Re-enable button
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.style.opacity = '1';
            printBtn.style.cursor = 'pointer';
        }
    }
}

// Close color card modal
function closeColorCardModal() {
    const modal = document.getElementById('colorCardModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Ungrey other wheels
    if (window.ungreyOtherWheels) {
        window.ungreyOtherWheels();
    }
}

// Initialize color card feature
export function initColorCard() {
    const generateBtn = document.getElementById('generateColorCardBtn');
    const closeBtn = document.getElementById('colorCardModalClose');
    const printBtn = document.getElementById('colorCardPrintBtn');
    const modal = document.getElementById('colorCardModal');
    
    // Print/Export button click
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            exportColorCardToPDF();
        });
    }
    
    // Generate button click
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            openColorCardModal();
        });
    }
    
    // Close button click
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeColorCardModal();
        });
    }
    
    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeColorCardModal();
            }
        });
    }
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeColorCardModal();
        }
    });
}
