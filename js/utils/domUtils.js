/**
 * DOM utility functions
 */

// Add hover tooltip to color box
export function addHoverTooltipToColorBox(colorBox) {
    // Remove existing tooltip if any
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

