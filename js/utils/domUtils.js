/**
 * DOM utility functions
 */

// Add hover tooltip to color box
export function addHoverTooltipToColorBox(colorBox, forceUpdate = false) {
    // Get the color data (handle undefined/null)
    const name = colorBox.dataset.colorName || '';
    const type = colorBox.dataset.colorType || '';
    const producer = colorBox.dataset.colorProducer || '';
    
    // Show tooltip if at least one field has data (non-empty string after trimming)
    const hasName = String(name).trim() !== '';
    const hasType = String(type).trim() !== '';
    const hasProducer = String(producer).trim() !== '';
    
    // Always show tooltip if there's any data (Paint Colors should always have producer)
    // Only skip if ALL fields are truly empty (but this shouldn't happen for Paint Colors)
    if (!hasName && !hasType && !hasProducer) {
        // Remove existing tooltip if no data
        if (colorBox._tooltipElement && colorBox._tooltipElement.parentNode) {
            colorBox._tooltipElement.remove();
            delete colorBox._tooltipElement;
            delete colorBox.dataset.tooltipAttached;
        }
        return;
    }
    
    // Check if tooltip already exists
    if (colorBox.dataset.tooltipAttached === 'true' && colorBox._tooltipElement) {
        // Update existing tooltip content
        if (colorBox._tooltipElement.parentNode) {
            colorBox._tooltipElement.innerHTML = `
                <div class="tooltip-name">${name || 'N/A'}</div>
                <div class="tooltip-type">Type: ${type || 'N/A'}</div>
                <div class="tooltip-producer">Producer: ${producer || 'N/A'}</div>
            `;
        }
        return; // Tooltip content updated, handlers remain the same
    }
    
    // Create tooltip element and append to body for fixed positioning
    const tooltip = document.createElement('div');
    tooltip.className = 'color-tooltip';
    tooltip.style.display = 'none'; // Start hidden
    tooltip.innerHTML = `
        <div class="tooltip-name">${name || 'N/A'}</div>
        <div class="tooltip-type">Type: ${type || 'N/A'}</div>
        <div class="tooltip-producer">Producer: ${producer || 'N/A'}</div>
    `;
    document.body.appendChild(tooltip);
    
    // Store tooltip reference on colorBox for cleanup
    colorBox._tooltipElement = tooltip;
    
    // Mark as attached
    colorBox.dataset.tooltipAttached = 'true';
    
    // Attach to color box
    colorBox.addEventListener('mouseenter', function(e) {
        if (tooltip && tooltip.parentNode) {
            tooltip.style.display = 'block';
            updateTooltipPosition(e, colorBox, tooltip);
        }
    });
    
    colorBox.addEventListener('mousemove', function(e) {
        if (tooltip && tooltip.parentNode && tooltip.style.display === 'block') {
            updateTooltipPosition(e, colorBox, tooltip);
        }
    });
    
    colorBox.addEventListener('mouseleave', function(e) {
        // Hide tooltip immediately when mouse leaves color box
        if (tooltip && tooltip.parentNode) {
            tooltip.style.display = 'none';
        }
    });
}

// Update tooltip position using fixed positioning
function updateTooltipPosition(e, colorBox, tooltip) {
    const rect = colorBox.getBoundingClientRect();
    const tooltipHeight = 80; // Approximate tooltip height
    const tooltipWidth = 150; // Approximate tooltip width
    const spacing = 10;
    
    // Position above the color box
    let top = rect.top - tooltipHeight - spacing;
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    
    // If tooltip would go off the top of the screen, show it below instead
    if (top < 10) {
        top = rect.bottom + spacing;
    }
    
    // Keep tooltip within viewport horizontally
    const viewportWidth = window.innerWidth;
    if (left < 10) {
        left = 10;
    } else if (left + tooltipWidth > viewportWidth - 10) {
        left = viewportWidth - tooltipWidth - 10;
    }
    
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

