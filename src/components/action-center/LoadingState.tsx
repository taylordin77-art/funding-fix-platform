export function LoadingState() {
  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-6xl mx-auto px-4">
        {/* Skeleton header */}
        <div className="mb-8">
          <div className="shimmer-loading h-3 w-32 rounded-full mb-3" />
          <div className="shimmer-loading h-9 w-72 rounded-lg mb-4" />
          <div className="flex gap-3">
            <div className="shimmer-loading h-6 w-28 rounded-full" />
            <div className="shimmer-loading h-6 w-24 rounded-full" />
            <div className="shimmer-loading h-6 w-32 rounded-full" />
          </div>
        </div>

        {/* Skeleton summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card-premium p-4">
              <div className="shimmer-loading h-3 w-20 rounded-full mb-3" />
              <div className="shimmer-loading h-8 w-12 rounded-lg mb-2" />
              <div className="shimmer-loading h-2 w-16 rounded-full" />
            </div>
          ))}
        </div>

        {/* Skeleton filters */}
        <div className="card-premium p-4 mb-8">
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer-loading h-10 w-36 rounded-xl" />
            ))}
            <div className="shimmer-loading h-10 w-40 rounded-xl ml-auto" />
          </div>
        </div>

        {/* Skeleton queue + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Queue */}
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, g) => (
              <div key={g}>
                <div className="shimmer-loading h-5 w-40 rounded-full mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, c) => (
                    <div key={c} className="card-premium p-5">
                      <div className="flex gap-2 mb-3">
                        <div className="shimmer-loading h-5 w-16 rounded-full" />
                        <div className="shimmer-loading h-5 w-20 rounded-full" />
                        <div className="shimmer-loading h-5 w-24 rounded-full" />
                      </div>
                      <div className="shimmer-loading h-4 w-full rounded mb-2" />
                      <div className="shimmer-loading h-3 w-3/4 rounded mb-4" />
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="shimmer-loading h-3 w-24 rounded" />
                        <div className="shimmer-loading h-3 w-20 rounded" />
                      </div>
                      <div className="flex gap-2">
                        <div className="shimmer-loading h-8 w-24 rounded-full" />
                        <div className="shimmer-loading h-8 w-28 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card-premium p-5">
              <div className="shimmer-loading h-4 w-32 rounded-full mb-5" />
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-2">
                      <div className="shimmer-loading h-3 w-20 rounded-full" />
                      <div className="shimmer-loading h-3 w-8 rounded-full" />
                    </div>
                    <div className="shimmer-loading h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="card-premium p-5">
              <div className="shimmer-loading h-4 w-32 rounded-full mb-5" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shimmer-loading h-8 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
