/**
 * References feature - displays uploaded images gallery
 */

import { getCurrentPaletteId } from '../core/state.js';
import { loadModelImages, saveModelImages } from '../utils/storage.js';

// Image view modal state
let currentImageIndex = -1;
let currentImagesList = [];

// Load and display references gallery
export function loadReferencesGallery() {
    const gallery = document.getElementById('referencesGallery');
    if (!gallery) return;
    
    gallery.innerHTML = '';
    
    const currentId = getCurrentPaletteId();
    if (!currentId) {
        gallery.innerHTML = '<div class="references-gallery-empty">No model selected</div>';
        currentImagesList = [];
        return;
    }
    
    const images = loadModelImages(currentId);
    currentImagesList = images; // Store for modal navigation
    
    if (images.length === 0) {
        gallery.innerHTML = '<div class="references-gallery-empty">No images uploaded yet. Upload images using "Choose Image" in Palette Editor.</div>';
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
            removeReferenceImage(currentId, image.id);
        });
        galleryItem.appendChild(removeBtn);
        
        gallery.appendChild(galleryItem);
    });
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
function removeReferenceImage(paletteId, imageId) {
    const images = loadModelImages(paletteId);
    const filteredImages = images.filter(img => img.id !== imageId);
    saveModelImages(paletteId, filteredImages);
    
    // Close modal if it's showing the deleted image
    const modal = document.getElementById('imageViewModal');
    if (modal && modal.classList.contains('active')) {
        closeImageViewModal();
    }
    
    loadReferencesGallery();
    // Also update the Current Model tab if it's visible
    import('../ui/palettesPanel.js').then(({ loadUploadedImages }) => {
        loadUploadedImages();
    }).catch(err => {
        console.error('Error loading uploaded images:', err);
    });
}

// Initialize references feature
export function initReferences() {
    // Initialize image view modal
    initImageViewModal();
    
    // Initialize add reference dropdown
    initAddReferenceDropdown();
    
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
    
    // Toggle dropdown on button click
    if (addReferenceBtn && dropdownContainer) {
        addReferenceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContainer.classList.toggle('active');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (dropdownContainer && !dropdownContainer.contains(e.target)) {
            dropdownContainer.classList.remove('active');
        }
    });
    
    // Handle "Add File" option
    if (addReferenceFileBtn && referenceFileUpload) {
        addReferenceFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            referenceFileUpload.click();
            if (dropdownContainer) {
                dropdownContainer.classList.remove('active');
            }
        });
    }
    
    // Handle file upload
    if (referenceFileUpload) {
        referenceFileUpload.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    import('../ui/palettesPanel.js').then(({ saveImageToCurrentModel }) => {
                        if (saveImageToCurrentModel) {
                            saveImageToCurrentModel(file);
                        }
                    }).catch(err => {
                        console.error('Error saving image:', err);
                    });
                }
            });
            
            // Reset input
            referenceFileUpload.value = '';
        });
    }
    
    // Handle "Add Link" option
    if (addReferenceLinkBtn) {
        addReferenceLinkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdownContainer) {
                dropdownContainer.classList.remove('active');
            }
            
            const imageUrl = prompt('Enter image URL:');
            if (imageUrl && imageUrl.trim() !== '') {
                addImageFromLink(imageUrl.trim());
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

