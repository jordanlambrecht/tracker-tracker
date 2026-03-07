// src/app/page.tsx
export default function Home() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="bg-raised border border-border rounded-lg p-8 max-w-md">
        <h1 className="text-xl font-semibold text-primary mb-2">
          Tracker Tracker
        </h1>
        <p className="text-secondary text-sm mb-4">
          Command center initializing...
        </p>
        <div className="flex gap-3">
          <span className="text-accent font-mono text-sm">●</span>
          <span className="text-warn font-mono text-sm">●</span>
          <span className="text-danger font-mono text-sm">●</span>
          <span className="text-success font-mono text-sm">●</span>
        </div>
      </div>
    </div>
  )
}
