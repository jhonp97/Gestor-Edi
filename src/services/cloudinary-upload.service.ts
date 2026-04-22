import cloudinary from 'cloudinary'
import { cloudName, apiKey, apiSecret } from '@/lib/cloudinary'

export class CloudinaryUploadService {
  generateSignature(folder: string): { signature: string; timestamp: number; cloudName: string; apiKey: string; folder: string } {
    if (!apiSecret) {
      throw new Error('CLOUDINARY_URL no configurado')
    }

    const timestamp = Math.round(Date.now() / 1000)
    const paramsToSign = {
      folder,
      timestamp,
    }

    const signature = cloudinary.v2.utils.api_sign_request(paramsToSign, apiSecret)

    return {
      signature,
      timestamp,
      cloudName: cloudName || '',
      apiKey: apiKey || '',
      folder,
    }
  }
}

export const cloudinaryUploadService = new CloudinaryUploadService()
