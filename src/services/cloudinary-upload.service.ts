import cloudinary from 'cloudinary'

export class CloudinaryUploadService {
  generateSignature(folder: string): { signature: string; timestamp: number; cloudName: string; apiKey: string; folder: string } {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (cloudName && apiKey && apiSecret) {
      cloudinary.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      })
    }

    const timestamp = Math.round(Date.now() / 1000)
    const paramsToSign = {
      folder,
      timestamp,
    }

    if (!apiSecret) {
      throw new Error('CLOUDINARY_API_SECRET no configurado')
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
