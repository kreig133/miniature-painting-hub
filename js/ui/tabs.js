/**
 * Tab switching UI component
 */

import { loadReferencesGallery, initReferences } from '../features/references.js';

export function initTabs() {
    // Handle main tabs (Painting, Collection)
    const mainTabButtons = document.querySelectorAll('.main-tabs .tab-btn');
    const mainTabContents = document.querySelectorAll('.tab-content[id$="Tab"]:not(.sub-tab-content)');
    const hamburgerBtn = document.getElementById('hamburgerMenuBtn');

    // Function to update hamburger button visibility
    function updateHamburgerVisibility(activeTab) {
        if (hamburgerBtn) {
            if (activeTab === 'painting') {
                hamburgerBtn.style.display = 'flex';
                // Reset button position when switching back to Painting (panel is closed by default)
                const panel = document.getElementById('palettesPanel');
                if (panel && !panel.classList.contains('open')) {
                    hamburgerBtn.style.left = '';
                }
            } else {
                hamburgerBtn.style.display = 'none';
                // Also close the panel if it's open when switching to Collection tab
                const panel = document.getElementById('palettesPanel');
                if (panel && panel.classList.contains('open')) {
                    panel.classList.remove('open');
                    document.body.classList.remove('panel-open');
                    hamburgerBtn.classList.remove('active');
                }
                // Reset button position
                hamburgerBtn.style.left = '';
            }
        }
    }

    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all main buttons and contents
            mainTabButtons.forEach(btn => btn.classList.remove('active'));
            mainTabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(targetTab + 'Tab');
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Update hamburger button visibility
                updateHamburgerVisibility(targetTab);
                
                // Activate the first sub-tab of the selected main tab
                const firstSubTab = targetContent.querySelector('.sub-tabs .tab-btn');
                if (firstSubTab) {
                    firstSubTab.click();
                }
            }
        });
    });

    // Set initial hamburger button visibility based on active tab
    const activeMainTab = document.querySelector('.main-tabs .tab-btn.active');
    if (activeMainTab) {
        const activeTabId = activeMainTab.getAttribute('data-tab');
        updateHamburgerVisibility(activeTabId);
    }

    // Handle sub-tabs (within Painting or Collection)
    const subTabButtons = document.querySelectorAll('.sub-tabs .tab-btn');
    const subTabContents = document.querySelectorAll('.sub-tab-content');

    subTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            const parentTab = button.getAttribute('data-parent');
            
            // Only process if parent tab is active
            const parentTabContent = document.getElementById(parentTab + 'Tab');
            if (parentTabContent && parentTabContent.classList.contains('active')) {
                // Remove active class from all sub-buttons and sub-contents within the same parent
                const parentSubButtons = parentTabContent.querySelectorAll('.sub-tabs .tab-btn');
                const parentSubContents = parentTabContent.querySelectorAll('.sub-tab-content');
                
                parentSubButtons.forEach(btn => btn.classList.remove('active'));
                parentSubContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                const targetContent = document.getElementById(targetTab + 'Tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                    
                    // If Planning tab is activated, check and set mode based on mappings
                    if (targetTab === 'planning') {
                        // Calculate and set mode based on mappings:
                        // - If there is mapping -> view mode
                        // - No mapping -> edit mode
                        // This will automatically trigger loadPlanningTable() and button update via subscriptions
                        if (window.checkAndSetPlanningMode) {
                            window.checkAndSetPlanningMode();
                        }
                    }
                    
                    // If References tab is activated, load the gallery
                    if (targetTab === 'references') {
                        initReferences(); // Initialize modal if not already done
                        loadReferencesGallery().catch(err => {
                            console.error('Error loading references gallery:', err);
                        });
                    }
                }
            }
        });
    });
}

