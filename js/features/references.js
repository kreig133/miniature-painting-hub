/**
 * References feature - displays uploaded images gallery
 */

import { getCurrentModelId, getCurrentModel, updateCurrentModel } from '../core/state.js';
import { getImage, getImages, deleteImage } from '../utils/imageStorage.js';

// Image view modal state
let currentImageIndex = -1;
let currentImagesList = [];

// Load and display references gallery
export async function loadReferencesGallery() {
    const gallery = document.getElementById('referencesGallery');
    if (!gallery) return;
    
    gallery.innerHTML = '';
    
    const model = getCurrentModel();
    if (!model) {
        gallery.innerHTML = '<div class="references-gallery-empty">No model selected</div>';
        currentImagesList = [];
        return;
    }
    
    // Add drop zone as first item
    const dropZone = createDropZone();
    gallery.appendChild(dropZone);
    
    const imageIds = model.references || [];
    
    if (imageIds.length === 0) {
        currentImagesList = [];
        return;
    }
    
    // Load images from IndexedDB
    const images = await getImages(imageIds);
    currentImagesList = images; // Store for modal navigation
    
    if (images.length === 0) {
        return;
    }
    
    images.forEach((image, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'references-gallery-item';
        
        const img = document.createElement('img');
        img.src = image.dataUrl;
        img.alt = image.name || 'Reference image';
        
        // Click to open modal
        galleryItem.addEventListener('click', (e) => {
            // Don't open if clicking on remove button
            if (e.target.classList.contains('references-gallery-remove') || 
                e.target.closest('.references-gallery-remove')) {
                return;
            }
            openImageViewModal(index);
        });
        
        galleryItem.appendChild(img);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'references-gallery-remove';
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove image';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeReferenceImage(image.id);
        });
        galleryItem.appendChild(removeBtn);
        
        gallery.appendChild(galleryItem);
    });
}

// Create drag-and-drop zone
function createDropZone() {
    const dropZone = document.createElement('div');
    dropZone.className = 'references-drop-zone';
    dropZone.id = 'referencesDropZone';
    
    const dropZoneContent = document.createElement('div');
    dropZoneContent.className = 'references-drop-zone-content';
    
    const icon = document.createElement('div');
    icon.className = 'references-drop-zone-icon';
    icon.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
    `;
    
    const text = document.createElement('div');
    text.className = 'references-drop-zone-text';
    text.textContent = 'Drop images here';
    
    dropZoneContent.appendChild(icon);
    dropZoneContent.appendChild(text);
    dropZone.appendChild(dropZoneContent);
    
    // Drag and drop event handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                import('../ui/palettesPanel.js').then(({ saveImageToCurrentModel }) => {
                    if (saveImageToCurrentModel) {
                        saveImageToCurrentModel(file).then(() => {
                            // Reload gallery after saving
                            loadReferencesGallery();
                        }).catch(err => {
                            console.error('Error saving image:', err);
                        });
                    }
                }).catch(err => {
                    console.error('Error importing saveImageToCurrentModel:', err);
                });
            }
        });
    });
    
    // Click to open file picker
    dropZone.addEventListener('click', () => {
        const fileInput = document.getElementById('referenceFileUpload');
        if (fileInput) {
            fileInput.click();
        }
    });
    
    return dropZone;
}

// Open image view modal
function openImageViewModal(index) {
    if (index < 0 || index >= currentImagesList.length) return;
    
    currentImageIndex = index;
    const modal = document.getElementById('imageViewModal');
    const img = document.getElementById('imageViewImg');
    
    if (!modal || !img) return;
    
    // Grey out other wheels
    if (window.greyOutOtherWheels) {
        window.greyOutOtherWheels();
    }
    
    img.src = currentImagesList[index].dataUrl;
    img.alt = currentImagesList[index].name || 'Reference image';
    
    modal.classList.add('active');
    updateNavButtons();
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

// Close image view modal
function closeImageViewModal() {
    const modal = document.getElementById('imageViewModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Ungrey other wheels
        if (window.ungreyOtherWheels) {
            window.ungreyOtherWheels();
        }
    }
}

// Show next image
function showNextImage() {
    if (currentImagesList.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % currentImagesList.length;
    const img = document.getElementById('imageViewImg');
    if (img) {
        img.src = currentImagesList[currentImageIndex].dataUrl;
        img.alt = currentImagesList[currentImageIndex].name || 'Reference image';
    }
    updateNavButtons();
}

// Show previous image
function showPrevImage() {
    if (currentImagesList.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + currentImagesList.length) % currentImagesList.length;
    const img = document.getElementById('imageViewImg');
    if (img) {
        img.src = currentImagesList[currentImageIndex].dataUrl;
        img.alt = currentImagesList[currentImageIndex].name || 'Reference image';
    }
    updateNavButtons();
}

// Update navigation buttons visibility
function updateNavButtons() {
    const prevBtn = document.getElementById('imageViewPrev');
    const nextBtn = document.getElementById('imageViewNext');
    
    // Show/hide buttons based on number of images
    if (currentImagesList.length <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
    }
}

// Initialize image view modal
function initImageViewModal() {
    const modal = document.getElementById('imageViewModal');
    const closeBtn = document.getElementById('imageViewClose');
    const prevBtn = document.getElementById('imageViewPrev');
    const nextBtn = document.getElementById('imageViewNext');
    const img = document.getElementById('imageViewImg');
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeImageViewModal();
        });
    }
    
    // Previous button
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showPrevImage();
        });
    }
    
    // Next button
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showNextImage();
        });
    }
    
    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeImageViewModal();
            }
        });
    }
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeImageViewModal();
        } else if (e.key === 'ArrowLeft' && modal && modal.classList.contains('active')) {
            e.preventDefault();
            showPrevImage();
        } else if (e.key === 'ArrowRight' && modal && modal.classList.contains('active')) {
            e.preventDefault();
            showNextImage();
        }
    });
    
    // Prevent image click from closing modal
    if (img) {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// Remove a reference image
async function removeReferenceImage(imageId) {
    const model = getCurrentModel();
    if (!model) return;
    
    // Delete image from IndexedDB
    try {
        await deleteImage(imageId);
    } catch (error) {
        console.error('Error deleting image from IndexedDB:', error);
    }
    
    const filteredImageIds = model.references.filter(id => id !== imageId);
    
    // If this was the model_image, clear it
    if (model.model_image === imageId) {
        updateCurrentModel({ 
            references: filteredImageIds,
            model_image: filteredImageIds.length > 0 ? filteredImageIds[0] : null
        });
    } else {
        updateCurrentModel({ references: filteredImageIds });
    }
    
    // Close modal if it's showing the deleted image
    const modal = document.getElementById('imageViewModal');
    if (modal && modal.classList.contains('active')) {
        closeImageViewModal();
    }
    
    await loadReferencesGallery();
    // Also update the Current Model tab if it's visible
    import('../ui/palettesPanel.js').then(async ({ loadUploadedImages }) => {
        await loadUploadedImages();
    }).catch(err => {
        console.error('Error loading uploaded images:', err);
    });
}

// Track if references feature has been initialized
let referencesInitialized = false;

// Initialize references feature
export function initReferences() {
    // Initialize image view modal (can be called multiple times safely)
    initImageViewModal();
    
    // Initialize add reference dropdown (only if not already initialized)
    if (!referencesInitialized) {
        initAddReferenceDropdown();
        referencesInitialized = true;
    }
    
    // Gallery will be loaded when tab is activated
}

// Initialize add reference dropdown
function initAddReferenceDropdown() {
    const addReferenceBtn = document.getElementById('addReferenceBtn');
    const addReferenceDropdown = document.getElementById('addReferenceDropdown');
    const dropdownContainer = document.querySelector('.add-reference-dropdown');
    const addReferenceFileBtn = document.getElementById('addReferenceFileBtn');
    const addReferenceLinkBtn = document.getElementById('addReferenceLinkBtn');
    const referenceFileUpload = document.getElementById('referenceFileUpload');
    
    // Remove any existing event listeners by cloning and replacing the button
    // (This prevents duplicate listeners if init is called multiple times)
    if (addReferenceBtn && dropdownContainer) {
        const newBtn = addReferenceBtn.cloneNode(true);
        addReferenceBtn.parentNode.replaceChild(newBtn, addReferenceBtn);
        
        // Toggle dropdown on button click
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContainer.classList.toggle('active');
        });
    }
    
    // Close dropdown when clicking outside (only add once globally)
    if (!window.referencesDropdownOutsideClickHandler) {
        window.referencesDropdownOutsideClickHandler = (e) => {
            const container = document.querySelector('.add-reference-dropdown');
            if (container && !container.contains(e.target)) {
                container.classList.remove('active');
            }
        };
        document.addEventListener('click', window.referencesDropdownOutsideClickHandler);
    }
    
    // Handle "Add File" option
    const currentFileBtn = document.getElementById('addReferenceFileBtn');
    if (currentFileBtn && referenceFileUpload) {
        // Remove old listener by cloning
        const newFileBtn = currentFileBtn.cloneNode(true);
        currentFileBtn.parentNode.replaceChild(newFileBtn, currentFileBtn);
        
        newFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentFileInput = document.getElementById('referenceFileUpload');
            if (currentFileInput) {
                currentFileInput.click();
            }
            dropdownContainer.classList.remove('active');
        });
    }
    
    // Handle file upload
    const currentFileInput = document.getElementById('referenceFileUpload');
    if (currentFileInput) {
        // Remove old listener by cloning
        const newFileInput = currentFileInput.cloneNode(true);
        currentFileInput.parentNode.replaceChild(newFileInput, currentFileInput);
        
        newFileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            const { saveImageToCurrentModel } = await import('../ui/palettesPanel.js');
            
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    if (saveImageToCurrentModel) {
                        saveImageToCurrentModel(file).then(() => {
                            // Reload references gallery after saving
                            loadReferencesGallery();
                        }).catch(err => {
                            console.error('Error saving image:', err);
                        });
                    }
                }
            });
            
            // Reset input
            newFileInput.value = '';
        });
    }
    
    // Handle "Add Link" option
    const currentLinkBtn = document.getElementById('addReferenceLinkBtn');
    if (currentLinkBtn) {
        // Remove old listener by cloning
        const newLinkBtn = currentLinkBtn.cloneNode(true);
        currentLinkBtn.parentNode.replaceChild(newLinkBtn, currentLinkBtn);
        
        newLinkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContainer.classList.remove('active');
            
            const imageUrl = prompt('Enter image URL:');
            if (imageUrl && imageUrl.trim() !== '') {
                addImageFromLink(imageUrl.trim()).then(() => {
                    // Reload references gallery after adding
                    loadReferencesGallery();
                }).catch(err => {
                    console.error('Error adding image from link:', err);
                });
            }
        });
    }
}

// Add image from URL link
async function addImageFromLink(url) {
    try {
        // Try fetching with CORS first
        let response;
        try {
            response = await fetch(url, { mode: 'cors' });
        } catch (corsError) {
            // If CORS fails, try with no-cors (but this won't let us read the response)
            // Instead, we'll use an img element to load it and convert to canvas
            loadImageViaCanvas(url);
            return;
        }
        
        if (!response.ok) {
            alert('Failed to fetch image. Please check the URL and try again.');
            return;
        }
        
        // Check if it's an image
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            alert('The URL does not point to an image. Please provide a valid image URL.');
            return;
        }
        
        // Convert to blob then to data URL
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            const dataUrl = event.target.result;
            
            // Get filename from URL or use default
            const urlParts = url.split('/');
            const filename = urlParts[urlParts.length - 1].split('?')[0] || 'image.jpg';
            
            // Save the image using the data URL function
            import('../ui/palettesPanel.js').then((module) => {
                if (module.saveImageDataUrlToCurrentModel) {
                    module.saveImageDataUrlToCurrentModel(dataUrl, filename);
                } else if (module.saveImageToCurrentModel) {
                    // Fallback: create a File object from the blob
                    const file = new File([blob], filename, { type: contentType });
                    module.saveImageToCurrentModel(file);
                }
            }).catch(err => {
                console.error('Error saving image from link:', err);
                alert('Error saving image. Please try again.');
            });
        };
        
        reader.onerror = () => {
            alert('Error reading image data. Please try again.');
        };
        
        reader.readAsDataURL(blob);
        
    } catch (error) {
        console.error('Error fetching image:', error);
        // Try loading via canvas as fallback
        loadImageViaCanvas(url);
    }
}

// Fallback method: load image via canvas (works even with CORS restrictions)
function loadImageViaCanvas(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Try to request CORS
    
    img.onload = () => {
        try {
            // Create canvas and draw image
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // Convert to data URL
            const dataUrl = canvas.toDataURL('image/png');
            
            // Get filename from URL or use default
            const urlParts = url.split('/');
            const filename = urlParts[urlParts.length - 1].split('?')[0] || 'image.png';
            
            // Save the image
            import('../ui/palettesPanel.js').then((module) => {
                if (module.saveImageDataUrlToCurrentModel) {
                    module.saveImageDataUrlToCurrentModel(dataUrl, filename);
                }
            }).catch(err => {
                console.error('Error saving image from link:', err);
                alert('Error saving image. Please try again.');
            });
        } catch (canvasError) {
            console.error('Error converting image via canvas:', canvasError);
            alert('Failed to load image from URL. The image may be blocked by CORS policy. Please try downloading the image and using "Add File" instead.');
        }
    };
    
    img.onerror = () => {
        alert('Failed to load image from URL. The URL may be invalid or the image may be blocked by CORS policy. Please try downloading the image and using "Add File" instead.');
    };
    
    img.src = url;
}

