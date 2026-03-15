// src/app/(auth)/trackers/[id]/loading.tsx

export default function TrackerDetailLoading() {
  return (
    <div className="flex h-full min-h-[calc(100vh-6rem)] items-center justify-center">
      <p className="text-secondary text-sm font-mono animate-loading-breathe">Loading...</p>
    </div>
  )
}
