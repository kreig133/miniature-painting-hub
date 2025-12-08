/**
 * Main application initialization
 * This file orchestrates all modules and features
 */

import { initState, state, setPalette, setSortOrder, getCurrentColor } from './core/state.js';
import { loadPalette as loadPaletteFromStorage, saveSortOrder } from './utils/storage.js';
import { generateSplitGradient } from './utils/colorUtils.js';
import { addHoverTooltipToColorBox } from './utils/domUtils.js';

// UI Components
import { initTabs } from './ui/tabs.js';
import { initAddColorModal } from './ui/modals.js';

// Features
import { initPalette, loadPalette, sortPaletteByHSV, savePalette, addColorToPalette } from './features/palette.js';
import { initImagePicker, updateClosestMatchesDisplay, displayCurrentColor } from './features/imagePicker.js';
import { initMyCollection, loadMyCollection, addToMyCollection, updateHeaderCount } from './features/myCollection.js';
import { initPaintColors, mergePaintColorsData, loadPaintColors, getUniqueProducersAndTypes } from './features/paintColors.js';
import { initFilters, createFilterCheckboxes, filterData } from './features/filters.js';
import { 
    initPlanning, 
    loadPlanningTable, 
    initSortOrder, 
    initSaturationThreshold,
    findClosestFromPalette,
    findNthClosestFromPalette,
    findClosestFromMyCollection,
    findNthClosestFromMyCollection
} from './features/planning.js';
import {
    initColorWheel,
    drawPalettePointsOnWheel,
    drawCollectionPointsOnWheel,
    initFloatingWheel,
    initCollectionFloatingWheel,
    initCollectionWheel,
    initColorWheelSliders,
    initSelectedColorFilterToggle,
    highlightAndScrollToPaletteItem,
    highlightAndScrollToCollectionItem
} from './features/colorWheel.js';

// Initialize application
export function init() {
    // 1. Initialize state from localStorage
    initState();
    
    // 2. Sort palette with saved sort order on load
    const palette = loadPaletteFromStorage();
    const sortedPalette = sortPaletteByHSV(palette, state.sortOrder);
    setPalette(sortedPalette);
    savePalette();
    
    // 3. Merge paint colors data (must happen before filters)
    mergePaintColorsData();
    
    // 4. Initialize UI components (no dependencies)
    initTabs();
    
    // 5. Initialize filters (needs paint colors data)
    initFilters({
        loadPaintColors,
        loadMyCollection,
        updatePlanningTable: () => {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        },
        updateClosestMatches: () => {
            updateClosestMatchesDisplay();
        },
        drawCollectionPointsOnWheel,
        getCurrentColor
    });
    
    // Create filter checkboxes after filters module is initialized
    createFilterCheckboxes('paintColorsFilters');
    createFilterCheckboxes('myCollectionFilters');
    createFilterCheckboxes('planningFilters');
    createFilterCheckboxes('selectedColorFilters');
    
    // 6. Initialize my collection (needed before paint colors)
    initMyCollection({
        drawCollectionPointsOnWheel,
        updatePlanningTable: () => {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        },
        updateClosestMatches: () => {
            updateClosestMatchesDisplay();
        },
        filterData
    });
    
    // 7. Initialize paint colors (after myCollection is ready)
    initPaintColors({
        filterData,
        addToMyCollection
    });
    
    // 8. Initialize palette
    initPalette({
        drawPalettePointsOnWheel,
        updateClosestMatches: () => {
            updateClosestMatchesDisplay();
        },
        updatePlanningTable: () => {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        }
    });
    loadPalette();
    
    // 9. Initialize image picker
    initImagePicker({
        updateClosestMatches: updateClosestMatchesDisplay,
        findClosestFromPalette,
        findNthClosestFromPalette,
        findClosestFromMyCollection,
        findNthClosestFromMyCollection,
        addHoverTooltipToColorBox,
        addColorToPalette
    });
    
    // 10. Initialize planning
    initPlanning({
        saveSortOrder,
        setSortOrder,
        sortPaletteByHSV,
        savePalette,
        loadPalette
    });
    
    // 11. Initialize color wheel
    initColorWheel({
        displayCurrentColor: () => {
            // Display current color and update matches when color changes from wheel
            displayCurrentColor();
        },
        updateColorWheelPreview: null // Uses default
    });
    
    // 12. Initialize color preview gradient
    initColorPreview();
    
    // 13. Initialize modals
    initAddColorModal(addToMyCollection);
    
    // 14. Initialize sort order and saturation threshold (from planning)
    initSortOrder({
        saveSortOrder,
        setSortOrder,
        sortPaletteByHSV,
        savePalette,
        loadPalette
    });
    initSaturationThreshold();
    
    // 15. Initialize selected color filter toggle
    initSelectedColorFilterToggle();
    
    // 16. Load initial data
    loadPaintColors();
    loadMyCollection();
    loadPlanningTable();
    
    // 17. Initialize floating wheels (use setTimeout to ensure DOM is ready)
    setTimeout(() => {
        initFloatingWheel();
        initCollectionFloatingWheel();
        initCollectionWheel();
        initColorWheelSliders();
    }, 0);
    
    // 18. Initialize copy buttons
    initCopyButtons();
}

// Initialize color preview gradient click
function initColorPreview() {
    const colorPreview = document.getElementById('colorPreview');
    if (colorPreview) {
        colorPreview.addEventListener('click', function() {
            const currentColor = getCurrentColor();
            if (currentColor) {
                const gradient = generateSplitGradient(
                    currentColor.hex, 
                    currentColor.r, 
                    currentColor.g, 
                    currentColor.b
                );
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
            const currentColor = getCurrentColor();
            if (currentColor) {
                this.style.backgroundColor = currentColor.hex;
            }
        });
    }
}

// Initialize copy buttons
function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-copy');
            let text = '';
            
            const currentColor = getCurrentColor();
            if (!currentColor) return;
            
            if (type === 'hex') {
                text = currentColor.hex.toUpperCase();
            } else if (type === 'rgb') {
                text = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
            }
            
            if (text) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 1000);
                });
            }
        });
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
