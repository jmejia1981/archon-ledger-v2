/**
 * Utility functions for image handling in PDFs
 */

/**
 * Convert an image URL or file to base64 string
 */
export async function imageToBase64(imagePath: string): Promise<string> {
  try {
    // If it's already a data URL, return it as is
    if (imagePath.startsWith('data:')) {
      return imagePath
    }

    // If it's a file path starting with /, fetch from public folder
    if (imagePath.startsWith('/')) {
      const response = await fetch(imagePath)
      if (!response.ok) {
        console.warn(`Failed to load image from ${imagePath}`)
        return ''
      }
      const blob = await response.blob()
      return await blobToBase64(blob)
    }

    // If it's a full URL, fetch it
    if (imagePath.startsWith('http')) {
      const response = await fetch(imagePath)
      const blob = await response.blob()
      return await blobToBase64(blob)
    }

    return ''
  } catch (error) {
    console.error('Error converting image to base64:', error)
    return ''
  }
}

/**
 * Convert a Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Get the Archon logo as base64
 * Assumes logo is stored at /images/archon-logo.png
 */
export async function getArchonLogo(): Promise<string> {
  return imageToBase64('/images/archon-logo.png')
}
