// src/app/(auth)/trackers/[id]/loading.tsx

export default function TrackerDetailLoading() {
  return (
    <div className="full-page-loader">
      <p className="text-secondary text-sm font-mono animate-loading-breathe">Loading...</p>
    </div>
  )
}
