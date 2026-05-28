import { useCallback, useEffect, useState } from "react"
import { RefreshCw, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ImageCard } from "@/components/ImageCard"
import { ImageDetail } from "@/components/ImageDetail"
import { api } from "@/lib/api"
import type { ImageMetadata } from "@/types"

const PAGE_SIZE = 20

export function ImageGallery() {
  const [images, setImages] = useState<ImageMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = useCallback(async (offset = 0) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listImages(offset, PAGE_SIZE)
      if (offset === 0) {
        setImages(data)
      } else {
        setImages((prev) => [...prev, ...data])
      }
      setHasMore(data.length === PAGE_SIZE)
      setSkip(offset)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  function handleDelete(id: number) {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${images.length} image${images.length !== 1 ? "s" : ""}`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8 text-xs"
          onClick={() => load(0)}
          disabled={loading}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <button className="text-xs underline underline-offset-2 ml-4" onClick={() => load(0)}>Retry</button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && images.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="retro-box bg-card overflow-hidden">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && images.length === 0 && !error && (
        <div className="retro-box flex flex-col items-center gap-3 p-16 text-center bg-card">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ImageOff className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No images yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload something to get started</p>
          </div>
        </div>
      )}

      {/* Gallery grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              onDelete={handleDelete}
              onView={setSelectedId}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(skip + PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      )}

      {/* Detail modal */}
      <ImageDetail imageId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
