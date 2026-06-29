/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a file to Cloudinary if credentials are provided in the environment.
 * Otherwise, falls back to uploading to Firebase Storage.
 * If both are unavailable or fail, converts the file to a Base64 data URL.
 * 
 * @param file The file to upload (HTML File object)
 * @param pathName The folder/file prefix to use for Firebase Storage
 */
export async function uploadFile(file: File, pathName: string = 'documents'): Promise<string> {
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // 1. Try Cloudinary if configured
  if (cloudName && uploadPreset) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Cloudinary upload failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data && data.secure_url) {
        return data.secure_url;
      }
    } catch (error) {
      console.warn('Cloudinary upload failed, falling back to Firebase Storage:', error);
    }
  }

  // 2. Try Firebase Storage
  if (storage) {
    try {
      const storageRef = ref(storage, `${pathName}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (error) {
      console.warn('Firebase Storage upload failed, falling back to Base64:', error);
    }
  }

  // 3. Fallback to local Base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
