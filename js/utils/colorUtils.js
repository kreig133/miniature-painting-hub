/**
 * Color utility functions for conversions and calculations
 */

// Convert RGB to HEX
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Convert RGB to HSV (Hue, Saturation, Value)
export function rgbToHSV(r, g, b) {
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
// Hue difference is multiplied by 3 and handles circular wraparound
export function hsvDistance(hsv1, hsv2) {
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

// Calculate color distance using CIEDE2000 algorithm
// Parameters: r1, g1, b1 (first color RGB), r2, g2, b2 (second color RGB)
// Returns: delta_e (color difference as float)
export function ciede2000Distance(r1, g1, b1, r2, g2, b2) {
    // Check if ciede_2000 function is available
    if (typeof ciede_2000 === 'undefined') {
        console.warn('CIEDE2000 library not loaded, falling back to HSV distance');
        // Fallback to HSV distance if CIEDE2000 is not available
        const hsv1 = rgbToHSV(r1, g1, b1);
        const hsv2 = rgbToHSV(r2, g2, b2);
        return hsvDistance(hsv1, hsv2);
    }
    
    try {
        return ciede_2000(r1, g1, b1, r2, g2, b2);
    } catch (error) {
        console.error('Error calculating CIEDE2000 distance:', error);
        // Fallback to HSV distance on error
        const hsv1 = rgbToHSV(r1, g1, b1);
        const hsv2 = rgbToHSV(r2, g2, b2);
        return hsvDistance(hsv1, hsv2);
    }
}

// Convert HSV to RGB
export function hsvToRGB(h, s, v) {
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

// Convert HEX to RGB
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Generate gradient CSS string with same hue and saturation, value from 0 to 1
export function generateValueGradient(hue, saturation) {
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
export function generateSplitGradient(colorHex, colorR, colorG, colorB) {
    // Upper gradient: white to color (left to right)
    const upperGradient = `linear-gradient(to right, #FFFFFF, ${colorHex})`;
    
    // Lower gradient: color to black (left to right)
    const lowerGradient = `linear-gradient(to right, ${colorHex}, #000000)`;
    
    // Combine both gradients, each taking 50% height
    return `${upperGradient}, ${lowerGradient}`;
}

// Add gradient click functionality to a color box element
export function addGradientClickToColorBox(colorBox, colorHex) {
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
            colorBox.style.backgroundImage = '';
            colorBox.style.backgroundSize = '';
            colorBox.style.backgroundPosition = '';
            colorBox.style.backgroundRepeat = '';
            colorBox.style.backgroundColor = originalColor;
            isShowingGradient = false;
        }
    });
    
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

