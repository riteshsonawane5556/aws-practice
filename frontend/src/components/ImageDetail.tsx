import { useEffect, useState } from "react"
import { Copy, Check, X, ExternalLink, ImageOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { api, formatBytes, formatDate } from "@/lib/api"
import type { ImageDetailResponse } from "@/types"

interface ImageDetailProps {
  imageId: number | null
  onClose: () => void
}

export function ImageDetail({ imageId, onClose }: ImageDetailProps) {
  const [data, setData] = useState<ImageDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (imageId == null) {
      setData(null)
      setError(null)
      setImgError(false)
      return
    }
    setLoading(true)
    setError(null)
    setImgError(false)
    api
      .getImage(imageId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [imageId])

  async function copyUrl() {
    if (!data) return
    await navigator.clipboard.writeText(data.presigned_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={imageId != null} onOpenChange={(open) => !open && onClose()}>
      {/*
        max-h-[90dvh] + flex flex-col: keeps the dialog within the viewport on any screen size.
        The header stays fixed; only the body scrolls.
      */}
      <DialogContent
        showCloseButton={false}
        className="bg-card max-w-2xl w-full p-0 gap-0 rounded-2xl border border-border shadow-xl max-h-[90dvh] flex flex-col"
      >
        {/* ── Fixed header ── */}
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Image Details
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground -mr-1"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* ── Image preview ── */}
              <div className="rounded-xl bg-muted border border-border flex items-center justify-center w-full" style={{ minHeight: "12rem" }}>
                {imgError ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <ImageOff className="w-8 h-8" />
                    <p className="text-xs text-center">
                      Image failed to load.{" "}
                      <button
                        className="underline underline-offset-2 hover:text-foreground"
                        onClick={() => window.open(data.presigned_url, "_blank")}
                      >
                        Open directly
                      </button>
                    </p>
                  </div>
                ) : (
                  <img
                    key={data.presigned_url}
                    src={data.presigned_url}
                    alt={data.original_filename}
                    className="max-h-80 max-w-full w-auto h-auto object-contain rounded-xl"
                    onError={() => setImgError(true)}
                  />
                )}
              </div>

              <Separator />

              {/* ── Metadata ── */}
              <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2">
                <span className="text-muted-foreground text-xs font-medium leading-5">Filename</span>
                <span className="text-foreground break-all text-xs leading-5">{data.original_filename}</span>

                <span className="text-muted-foreground text-xs font-medium leading-5">ID</span>
                <span className="text-primary text-xs font-mono leading-5">#{data.id}</span>

                <span className="text-muted-foreground text-xs font-medium leading-5">Size</span>
                <span className="text-xs leading-5">{formatBytes(data.file_size)}</span>

                <span className="text-muted-foreground text-xs font-medium leading-5">Type</span>
                <Badge variant="outline" className="text-[10px] w-fit px-1.5 py-0 h-4 self-center">
                  {data.content_type}
                </Badge>

                <span className="text-muted-foreground text-xs font-medium leading-5">Uploaded</span>
                <span className="text-xs leading-5">{formatDate(data.created_at)}</span>

                <span className="text-muted-foreground text-xs font-medium leading-5">S3 Key</span>
                <span className="text-muted-foreground break-all text-[10px] font-mono leading-5">{data.s3_key}</span>
              </div>

              <Separator />

              {/* ── Presigned URL ── */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Presigned URL{" "}
                  <span className="font-normal">(expires in ~1 hour)</span>
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 bg-muted rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground truncate font-mono">
                    {data.presigned_url}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={copyUrl}
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => window.open(data.presigned_url, "_blank")}
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
