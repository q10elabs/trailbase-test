// Background image operations and image processing utilities
// Handles loading, uploading, and processing background images

import { client, getBackgroundImageRecordId, setBackgroundImageRecordId } from './state';
import { TRAILBASE_URL } from './config';
import { counterError, backgroundImageInput, uploadImageBtn, container, showError, hideError } from './ui';

// Image processing utilities
export async function convertImageToWebP(file: File, maxSizeBytes: number = 1024 * 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      // Start with original dimensions
      let width = img.width;
      let height = img.height;
      let quality = 0.9;

      const resizeAndCompress = () => {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            // If blob is too large, reduce quality or size
            if (blob.size > maxSizeBytes && quality > 0.1) {
              // First try reducing quality
              if (quality > 0.3) {
                quality -= 0.1;
                resizeAndCompress();
              } else {
                // Then reduce dimensions
                width = Math.floor(width * 0.9);
                height = Math.floor(height * 0.9);
                quality = 0.9; // Reset quality for new size
                resizeAndCompress();
              }
            } else {
              resolve(blob);
            }
          },
          'image/webp',
          quality
        );
      };

      resizeAndCompress();
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

// Background image operations
export async function loadBackgroundImage() {
  try {
    const user = client.user();
    if (!user) {
      return;
    }

    const api = client.records('user_background_images');
    
    // Try to find existing background image for this user
    const result = await api.list({
      pagination: { limit: 1 },
    });

    if (result.records && result.records.length > 0) {
      const record = result.records[0] as { id: number; background_image?: { filename?: string } };
      setBackgroundImageRecordId(record.id);
      
      if (record.background_image?.filename) {
        // Construct the file URL (no cache-busting needed on initial load)
        const fileUrl = `${TRAILBASE_URL}/api/records/v1/user_background_images/${record.id}/file/background_image`;
        // Set background image on the ::before pseudo-element
        const style = document.createElement('style');
        style.textContent = `
          .container::before {
            background-image: url(${fileUrl});
          }
        `;
        // Remove existing style if any
        const existingStyle = document.getElementById('bg-image-style');
        if (existingStyle) {
          existingStyle.remove();
        }
        style.id = 'bg-image-style';
        document.head.appendChild(style);
      }
    }
  } catch (err: any) {
    console.error('Error loading background image:', err);
    // Don't show error to user, just log it
  }
}

export async function uploadBackgroundImage() {
  try {
    const user = client.user();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const file = backgroundImageInput.files?.[0];
    if (!file) {
      showError(counterError, 'Please select an image file');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError(counterError, 'Please select a valid image file');
      return;
    }

    hideError(counterError);
    uploadImageBtn.disabled = true;

    // Convert to WebP and resize to max 1MB
    const webpBlob = await convertImageToWebP(file, 1024 * 1024);
    
    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('user', user.id);
    formData.append('background_image', webpBlob, 'background.webp');

    // Check if we have an existing record
    let recordId: number;
    const existingRecordId = getBackgroundImageRecordId();

    if (existingRecordId) {
      // Update existing record
      recordId = existingRecordId;
      
      // For multipart update, use client.fetch to ensure authentication headers are included
      const response = await client.fetch(`/api/records/v1/user_background_images/${recordId}`, {
        method: 'PATCH',
        body: formData,
        throwOnError: false,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to update background image');
      }
    } else {
      // Create new record
      const response = await client.fetch('/api/records/v1/user_background_images', {
        method: 'POST',
        body: formData,
        throwOnError: false,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to upload background image');
      }

      const result = await response.json() as { ids: number[] };
      recordId = result.ids[0];
      setBackgroundImageRecordId(recordId);
    }

    // Update the background image display
    // Add cache-busting parameter to force browser to reload the image
    const cacheBuster = Date.now();
    const fileUrl = `${TRAILBASE_URL}/api/records/v1/user_background_images/${recordId}/file/background_image?t=${cacheBuster}`;
    
    // Remove existing style first to force re-render
    const existingStyle = document.getElementById('bg-image-style');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Force a reflow to ensure the old style is removed
    void container.offsetHeight;
    
    // Set background image on the ::before pseudo-element
    const style = document.createElement('style');
    style.id = 'bg-image-style';
    style.textContent = `
      .container::before {
        background-image: url("${fileUrl}");
      }
    `;
    document.head.appendChild(style);

    // Clear the file input
    backgroundImageInput.value = '';
  } catch (err: any) {
    console.error('Error uploading background image:', err);
    showError(counterError, err.message || 'Failed to upload background image');
  } finally {
    uploadImageBtn.disabled = false;
  }
}
