export interface ImageMetadata {
  id: number
  original_filename: string
  s3_key: string
  content_type: string
  file_size: number
  created_at: string
}

export interface ImageDetailResponse extends ImageMetadata {
  presigned_url: string
}

export interface ImageUploadResponse extends ImageMetadata {
  presigned_url: string
}

export interface GenerateUploadUrlResponse {
  s3_key: string
  upload_url: string
  expires_in: number
}

export interface S3Object {
  key: string
  size: number
  last_modified: string
  etag?: string
}

export interface S3ObjectsResponse {
  objects: S3Object[]
  count: number
  bucket: string
  prefix: string
}

export interface DeleteResponse {
  message: string
  id: number
}

export interface HealthResponse {
  status: string
}
