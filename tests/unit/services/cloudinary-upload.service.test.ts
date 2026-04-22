import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cloudinary', () => ({
  cloudName: 'test-cloud',
  apiKey: 'test-key',
  apiSecret: 'test-secret',
}))

vi.mock('cloudinary', () => ({
  default: {
    v2: {
      config: vi.fn(),
      utils: {
        api_sign_request: vi.fn().mockReturnValue('mock-signature'),
      },
    },
  },
}))

import { CloudinaryUploadService } from '@/services/cloudinary-upload.service'
import cloudinary from 'cloudinary'

describe('CloudinaryUploadService', () => {
  let service: CloudinaryUploadService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CloudinaryUploadService()
  })

  it('debería generar firma con timestamp', () => {
    const result = service.generateSignature('folder/profiles')
    expect(result.signature).toBe('mock-signature')
    expect(result.timestamp).toBeGreaterThan(0)
    expect(result.cloudName).toBe('test-cloud')
    expect(result.apiKey).toBe('test-key')
    expect(result.folder).toBe('folder/profiles')
  })

  it('debería llamar a api_sign_request con params correctos', () => {
    service.generateSignature('folder/profiles')
    expect(cloudinary.v2.utils.api_sign_request).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'folder/profiles',
        timestamp: expect.any(Number),
      }),
      'test-secret'
    )
  })
})
