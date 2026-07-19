export function DashboardSkeleton() {
  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <div className="shimmer-loading h-3 w-32 rounded-full mb-3" />
          <div className="shimmer-loading h-9 w-72 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card-premium p-7">
            <div className="shimmer-loading h-4 w-40 rounded-full mb-5" />
            <div className="shimmer-loading h-16 w-40 rounded-xl mb-4" />
            <div className="shimmer-loading h-4 w-56 rounded-full" />
          </div>
          <div className="card-premium p-7">
            <div className="shimmer-loading h-4 w-40 rounded-full mb-5" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="shimmer-loading h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card-premium p-6">
              <div className="shimmer-loading h-5 w-28 rounded-full mb-4" />
              <div className="shimmer-loading h-10 w-24 rounded-lg mb-3" />
              <div className="shimmer-loading h-4 w-40 rounded-full" />
            </div>
          ))}
        </div>

        <div className="card-premium p-7">
          <div className="shimmer-loading h-5 w-40 rounded-full mb-5" />
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="shimmer-loading h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
