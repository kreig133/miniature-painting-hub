/**
 * Main application initialization
 * This file orchestrates all modules and features
 */

import { initState, state, setSortOrder, getCurrentColor } from './core/state.js';
import { saveSortOrder } from './utils/storage.js';
import { generateSplitGradient } from './utils/colorUtils.js';
import { addHoverTooltipToColorBox } from './utils/domUtils.js';

// UI Components
import { initTabs } from './ui/tabs.js';
import { initAddColorModal } from './ui/modals.js';
import { initPalettesPanel, loadPalettesList } from './ui/palettesPanel.js';

// Features
import { initPalette, loadPalette, sortPaletteByHSV, addColorToPalette, updatePaletteName, getPalette } from './features/palette.js';
import { initImagePicker, updateClosestMatchesDisplay, displayCurrentColor } from './features/imagePicker.js';
import { initMyCollection, loadMyCollection, addToMyCollection, updateHeaderCount, notifyEffectiveCollectionChanged } from './features/myCollection.js';
import { initShopping, loadShoppingCart, addToShoppingCart } from './features/shopping.js';
import { initPaintColors, mergePaintColorsData, loadPaintColors, getUniqueProducersAndTypes } from './features/paintColors.js';
import { initFilters, createFilterCheckboxes, filterData, setMixingCallback } from './features/filters.js';
import { 
    initPlanning,
    checkAndSetPlanningMode, 
    loadPlanningTable, 
    initSortOrder, 
    findClosestFromPalette,
    findNthClosestFromPalette,
    findClosestFromMyCollection,
    findNthClosestFromMyCollection,
    findClosestFromPaintColors
} from './features/planning.js';
import { initMixing, loadMixingTable } from './features/mixing.js';
import {
    initColorWheel,
    drawPalettePointsOnWheel,
    drawCollectionPointsOnWheel,
    drawPaintColorsPointsOnWheel,
    initFloatingWheel,
    initCollectionFloatingWheel,
    initPaintColorsFloatingWheel,
    initColorSelectFloatingWheel,
    initCollectionWheel,
    initPaintColorsWheel,
    initColorWheelSliders,
    initSelectedColorFilterToggle,
    highlightAndScrollToPaletteItem,
    highlightAndScrollToCollectionItem
} from './features/colorWheel.js';
import { initColorCard } from './features/colorCard.js';

// Initialize application
export function init() {
    // 1. Initialize state from localStorage
    initState();
    
    // 2. Sort current palette with saved sort order on load (if we have models)
    const palette = getPalette();
    if (palette.length > 0) {
        const sortedPalette = sortPaletteByHSV(palette, state.sortOrder);
        // Update palette - colors need to be updated in the model structure
        // This will be handled by palette.js functions
    }
    
    // 3. Merge paint colors data (must happen before filters)
    mergePaintColorsData();
    
    // 4. Initialize UI components (no dependencies)
    initTabs();
    
    // Initialize palettes panel
    initPalettesPanel({
        loadPalette: () => {
            loadPalette();
            if (drawPalettePointsOnWheel) {
                drawPalettePointsOnWheel();
            }
        },
        updatePaletteName,
        updatePalettesList: loadPalettesList,
        updatePlanningTable: () => {
            loadPlanningTable();
        }
    });
    
    // 5. Initialize filters (needs paint colors data)
    // Note: drawPaintColorsPointsOnWheel will be set after color wheel is initialized
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
        drawPaintColorsPointsOnWheel,
        getCurrentColor
    });
    
    // Create filter checkboxes after filters module is initialized
    createFilterCheckboxes('paintColorsFilters');
    createFilterCheckboxes('myCollectionFilters');
    createFilterCheckboxes('shoppingFilters');
    createFilterCheckboxes('planningFilters');
    createFilterCheckboxes('selectedColorFilters');
    createFilterCheckboxes('mixingFilters');
    
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
        updateMixingTable: loadMixingTable,
        filterData
    });
    
    // 7. Initialize shopping (before paint colors to provide addToShoppingCart)
    initShopping({
        filterData,
        drawCollectionPointsOnWheel,
        notifyEffectiveCollectionChanged,
        loadMyCollection
    });
    
    // 8. Initialize paint colors (after myCollection and shopping are ready)
    initPaintColors({
        filterData,
        addToMyCollection,
        addToShoppingCart
    });
    
    // 9. Initialize palette
    initPalette({
        drawPalettePointsOnWheel,
        updateClosestMatches: () => {
            updateClosestMatchesDisplay();
        },
        updatePlanningTable: () => {
            if (window.updatePlanningTable) {
                window.updatePlanningTable();
            }
        },
        updatePalettesList: loadPalettesList
    });
    loadPalette();
    
    // Update palette name in header
    updatePaletteName();
    
    // Load palettes list in panel
    loadPalettesList();
    
    // 9. Initialize image picker
    initImagePicker({
        updateClosestMatches: updateClosestMatchesDisplay,
        findClosestFromPalette,
        findNthClosestFromPalette,
        findClosestFromMyCollection,
        findNthClosestFromMyCollection,
        findClosestFromPaintColors,
        addHoverTooltipToColorBox,
        addColorToPalette
    });
    
    // 10. Initialize planning
    initPlanning({
        addToShoppingCart,
        saveSortOrder,
        setSortOrder,
        sortPaletteByHSV,
        loadPalette,
        addColorToPalette
    });
    
    // Make planning functions available globally
    window.checkAndSetPlanningMode = checkAndSetPlanningMode;
    window.loadPlanningTable = loadPlanningTable;
    
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
    
    // 14. Initialize sort order (from planning)
    initSortOrder({
        saveSortOrder,
        setSortOrder,
        sortPaletteByHSV,
        loadPalette
    });
    
    // 15. Initialize selected color filter toggle
    initSelectedColorFilterToggle();
    
    // 16. Set up mixing callback for filters
    setMixingCallback(loadMixingTable);
    
    // 17. Initialize mixing feature
    initMixing();
    
    // 18. Initialize color card feature
    initColorCard();
    
    // 19. Load initial data
    loadPaintColors();
    loadMyCollection();
    // Don't call loadPlanningTable() here - it will be called by checkAndSetPlanningMode()
    // when Planning tab is activated, or during initPlanning() if Planning is already active
    loadMixingTable();
    loadMixingTable();
    
    // 17. Initialize floating wheels (use setTimeout to ensure DOM is ready)
    setTimeout(() => {
        initFloatingWheel();
        initCollectionFloatingWheel();
        initPaintColorsFloatingWheel();
        initColorSelectFloatingWheel();
        initCollectionWheel();
        initPaintColorsWheel();
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
