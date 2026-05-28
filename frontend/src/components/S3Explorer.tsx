import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { api, formatBytes, formatDate } from "@/lib/api"
import type { S3Object, S3ObjectsResponse } from "@/types"

export function S3Explorer() {
  const [data, setData] = useState<S3ObjectsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getS3Objects()
      setData(res)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">S3 Explorer</h2>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.bucket} · prefix: <span className="font-mono">{data.prefix || "/"}</span>
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8 text-xs"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex gap-3">
          <div className="retro-box bg-card px-4 py-3 min-w-[100px]">
            <p className="text-xs text-muted-foreground">Objects</p>
            <p className="text-2xl font-semibold text-primary mt-0.5">{data.count}</p>
          </div>
          <div className="retro-box bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs text-muted-foreground">Total size</p>
            <p className="text-2xl font-semibold text-primary mt-0.5">
              {formatBytes(data.objects.reduce((acc, o) => acc + o.size, 0))}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <button className="text-xs underline underline-offset-2 ml-4" onClick={load}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && data && data.objects.length > 0 && (
        <div className="retro-box overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">#</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Key</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Size</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Modified</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">ETag</th>
              </tr>
            </thead>
            <tbody>
              {data.objects.map((obj: S3Object, i) => (
                <tr key={obj.key} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 text-foreground max-w-xs">
                    <span className="block truncate font-mono" title={obj.key}>{obj.key}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {formatBytes(obj.size)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(obj.last_modified)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-[10px] font-mono max-w-[120px]">
                    <span className="block truncate" title={obj.etag}>
                      {obj.etag?.replace(/"/g, "") ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty */}
      {!loading && data && data.objects.length === 0 && (
        <div className="retro-box flex flex-col items-center gap-3 p-16 text-center bg-card">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Database className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No objects found</p>
            <p className="text-xs text-muted-foreground mt-1">The S3 prefix is empty</p>
          </div>
        </div>
      )}
    </div>
  )
}
