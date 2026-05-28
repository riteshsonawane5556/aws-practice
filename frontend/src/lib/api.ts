import type {
  DeleteResponse,
  GenerateUploadUrlResponse,
  HealthResponse,
  ImageDetailResponse,
  ImageMetadata,
  ImageUploadResponse,
  S3ObjectsResponse,
} from "@/types"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  health(): Promise<HealthResponse> {
    return request("/health")
  },

  listImages(skip = 0, limit = 20): Promise<ImageMetadata[]> {
    return request(`/images/?skip=${skip}&limit=${limit}`)
  },

  getImage(id: number): Promise<ImageDetailResponse> {
    return request(`/images/${id}`)
  },

  deleteImage(id: number): Promise<DeleteResponse> {
    return request(`/images/${id}`, { method: "DELETE" })
  },

  generateUploadUrl(
    filename: string,
    content_type: string,
    file_size: number
  ): Promise<GenerateUploadUrlResponse> {
    return request("/images/generate-upload-url", {
      method: "POST",
      body: JSON.stringify({ filename, content_type, file_size }),
    })
  },

  confirmUpload(
    original_filename: string,
    s3_key: string,
    content_type: string,
    file_size: number
  ): Promise<ImageUploadResponse> {
    return request("/images/confirm-upload", {
      method: "POST",
      body: JSON.stringify({ original_filename, s3_key, content_type, file_size }),
    })
  },

  getS3Objects(): Promise<S3ObjectsResponse> {
    return request("/images/s3-objects")
  },

  uploadToS3(
    url: string,
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`S3 upload failed: ${xhr.status}`))
      })
      xhr.addEventListener("error", () => reject(new Error("Network error during S3 upload")))
      xhr.open("PUT", url)
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.send(file)
    })
  },
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
