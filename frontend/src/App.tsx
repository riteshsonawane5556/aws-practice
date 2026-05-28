import { useEffect, useState } from "react"
import { Upload, Images, Database, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ImageGallery } from "@/components/ImageGallery"
import { ImageUpload } from "@/components/ImageUpload"
import { S3Explorer } from "@/components/S3Explorer"
import { useTheme } from "@/components/theme-provider"
import { api } from "@/lib/api"

type View = "gallery" | "upload" | "s3"

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "gallery", label: "Gallery", icon: Images },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "s3", label: "S3 Explorer", icon: Database },
]

export default function App() {
  const [view, setView] = useState<View>("gallery")
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking")
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    api
      .health()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"))
  }, [])

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Database className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-foreground text-base font-semibold tracking-tight">
              S3 Vault
            </h1>
            <p className="text-xs text-muted-foreground">
              AWS S3 Image Storage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Health indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                health === "ok"
                  ? "bg-emerald-500"
                  : health === "error"
                  ? "bg-destructive"
                  : "bg-muted-foreground animate-pulse"
              }`}
            />
            <span className="text-muted-foreground hidden sm:inline">
              API:{" "}
              <span
                className={
                  health === "ok"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : health === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {health === "checking" ? "checking…" : health}
              </span>
            </span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-border px-6 bg-card flex gap-1 pt-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2
              ${
                view === id
                  ? "text-primary border-b-primary bg-primary/5"
                  : "text-muted-foreground border-b-transparent hover:text-foreground hover:bg-muted/60"
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {view === "gallery" && <ImageGallery />}
        {view === "upload" && (
          <ImageUpload onSuccess={() => setView("gallery")} />
        )}
        {view === "s3" && <S3Explorer />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 flex items-center justify-between text-xs text-muted-foreground bg-card">
        <span>S3 Vault · AWS S3 + FastAPI</span>
        <span className="hidden sm:inline">Built with React &amp; Tailwind</span>
      </footer>
    </div>
  )
}
