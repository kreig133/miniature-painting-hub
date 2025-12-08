/**
 * Modal management UI component
 */

let addToMyCollectionCallback = null;

export function initAddColorModal(callback) {
    addToMyCollectionCallback = callback;
    
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
                    if (colorHex) colorHex.value = '#FFFFFF';
                    if (colorHexPicker) colorHexPicker.value = '#FFFFFF';
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
            if (addToMyCollectionCallback && addToMyCollectionCallback(colorData)) {
                // Close modal
                if (addColorModal) {
                    addColorModal.style.display = 'none';
                }
                // Reset form
                addColorForm.reset();
            } else {
                alert('This color already exists in your collection.');
            }
        });
    }
}

