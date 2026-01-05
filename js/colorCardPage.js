/**
 * Color Card Page - Standalone page for Color Card feature
 */

import { initState } from './core/state.js';
import { openColorCardModal, setupColorCardControls, initColorCardPage } from './features/colorCard.js';

// Initialize state
initState();

// Initialize Color Card when page loads
async function init() {
    // Setup controls
    setupColorCardControls();
    
    // Open the color card (load images, etc.)
    await openColorCardModal();
    
    // Initialize page-specific handlers (close button navigation)
    initColorCardPage();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

