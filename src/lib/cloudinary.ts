import cloudinary from 'cloudinary'

function parseCloudinaryUrl(url: string) {
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/)
  if (!match) return null
  return {
    apiKey: match[1],
    apiSecret: match[2],
    cloudName: match[3],
  }
}

const parsed = process.env.CLOUDINARY_URL
  ? parseCloudinaryUrl(process.env.CLOUDINARY_URL)
  : null

const cloudName = parsed?.cloudName || process.env.CLOUDINARY_CLOUD_NAME
const apiKey = parsed?.apiKey || process.env.CLOUDINARY_API_KEY
const apiSecret = parsed?.apiSecret || process.env.CLOUDINARY_API_SECRET

if (cloudName && apiKey && apiSecret) {
  cloudinary.v2.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  })
}

export { cloudinary }
export { cloudName, apiKey, apiSecret }
