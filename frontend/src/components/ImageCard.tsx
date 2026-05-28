import { useState } from "react"
import { Trash2, ImageIcon, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api, formatBytes, formatDate } from "@/lib/api"
import type { ImageMetadata } from "@/types"

interface ImageCardProps {
  image: ImageMetadata
  onDelete: (id: number) => void
  onView: (id: number) => void
}

export function ImageCard({ image, onDelete, onView }: ImageCardProps) {
  const [deleting, setDeleting] = useState(false)

  const ext = image.original_filename.split(".").pop()?.toUpperCase() ?? "IMG"

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${image.original_filename}"?`)) return
    setDeleting(true)
    try {
      await api.deleteImage(image.id)
      onDelete(image.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      className="retro-box bg-card cursor-pointer group relative flex flex-col overflow-hidden hover:shadow-md hover:border-primary/40 transition-all duration-200"
      onClick={() => onView(image.id)}
    >
      {/* Thumbnail area */}
      <div className="bg-muted flex items-center justify-center h-36 relative overflow-hidden">
        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
          <ImageIcon className="w-7 h-7" />
          <span className="text-[10px] font-medium tracking-widest">{ext}</span>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-white/90 dark:bg-black/60 rounded-full p-2">
            <Eye className="w-4 h-4 text-primary" />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs font-medium text-foreground truncate" title={image.original_filename}>
          {image.original_filename}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {formatBytes(image.file_size)}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {image.content_type.split("/")[1]?.toUpperCase()}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-auto">
          {formatDate(image.created_at)}
        </p>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-7 w-7 bg-white/80 dark:bg-black/50 text-destructive hover:bg-destructive/10 transition-opacity"
        onClick={handleDelete}
        disabled={deleting}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
