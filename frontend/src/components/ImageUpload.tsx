import { useCallback, useState } from "react"
import { Upload, FileImage, CheckCircle, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { api, formatBytes } from "@/lib/api"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024

type UploadStatus = "idle" | "generating" | "uploading" | "confirming" | "done" | "error"

interface LogLine {
  prefix: string
  msg: string
  type: "info" | "ok" | "err"
}

interface ImageUploadProps {
  onSuccess: () => void
}

export function ImageUpload({ onSuccess }: ImageUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<LogLine[]>([])
  const [dragging, setDragging] = useState(false)

  function addLog(prefix: string, msg: string, type: LogLine["type"] = "info") {
    setLog((prev) => [...prev, { prefix, msg, type }])
  }

  function reset() {
    setFile(null)
    setStatus("idle")
    setProgress(0)
    setLog([])
  }

  function validateFile(f: File): string | null {
    if (!ALLOWED_TYPES.includes(f.type)) return `Unsupported file type: ${f.type}`
    if (f.size > MAX_SIZE) return `File too large: ${formatBytes(f.size)} (max 10 MB)`
    return null
  }

  function pickFile(f: File) {
    const err = validateFile(f)
    if (err) {
      addLog("Error", err, "err")
      return
    }
    setFile(f)
    setLog([])
    setStatus("idle")
    addLog("Selected", `${f.name} (${formatBytes(f.size)})`, "info")
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
    e.target.value = ""
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [])

  async function handleUpload() {
    if (!file) return
    setLog([])
    setProgress(0)

    try {
      setStatus("generating")
      addLog("→", "Generating presigned upload URL…", "info")
      const { s3_key, upload_url } = await api.generateUploadUrl(
        file.name,
        file.type,
        file.size
      )
      addLog("✓", `Presigned URL ready (key: ${s3_key.slice(0, 32)}…)`, "ok")

      setStatus("uploading")
      addLog("→", "Uploading to S3…", "info")
      await api.uploadToS3(upload_url, file, (pct) => setProgress(pct))
      addLog("✓", `Uploaded ${formatBytes(file.size)} to S3`, "ok")
      setProgress(100)

      setStatus("confirming")
      addLog("→", "Confirming upload with server…", "info")
      const result = await api.confirmUpload(file.name, s3_key, file.type, file.size)
      addLog("✓", `Registered as image #${result.id}`, "ok")

      setStatus("done")
      addLog("✓", "Upload complete!", "ok")

      setTimeout(() => {
        onSuccess()
        reset()
      }, 1500)
    } catch (e) {
      setStatus("error")
      addLog("✕", (e as Error).message, "err")
    }
  }

  const busy = ["generating", "uploading", "confirming"].includes(status)

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Upload Image</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          JPEG, PNG, GIF, WEBP · Max 10 MB
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed transition-colors cursor-pointer
          ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}
          ${busy ? "pointer-events-none opacity-60" : ""}
        `}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !busy && document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={onFileInput}
        />
        {file ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileImage className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(file.size)} · {file.type}</p>
            </div>
            {!busy && (
              <button
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); reset() }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Drop your file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>
          </>
        )}
      </div>

      {/* Upload button */}
      {file && status !== "done" && (
        <Button
          className="w-full"
          onClick={handleUpload}
          disabled={busy}
        >
          {busy ? "Uploading…" : "Upload to S3"}
        </Button>
      )}

      {/* Progress */}
      {status === "uploading" && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Transferring to S3</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-1.5 text-sm">
          {log.map((line, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className={`shrink-0 text-xs mt-0.5 ${
                line.type === "ok" ? "text-emerald-600 dark:text-emerald-400" :
                line.type === "err" ? "text-destructive" :
                "text-muted-foreground"
              }`}>
                {line.prefix}
              </span>
              <span className={`text-xs ${
                line.type === "ok" ? "text-foreground" :
                line.type === "err" ? "text-destructive" :
                "text-muted-foreground"
              }`}>
                {line.msg}
              </span>
            </div>
          ))}
          {status === "done" && (
            <div className="flex items-center gap-2 mt-2 text-emerald-600 dark:text-emerald-400 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Redirecting to gallery…</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <button className="underline underline-offset-2" onClick={reset}>Reset and try again</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
