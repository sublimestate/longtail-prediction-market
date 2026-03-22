export default function PredictionLoading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="h-4 w-16 bg-navy-800 rounded animate-pulse mb-6" />
      <div className="mb-6">
        <div className="h-7 w-2/3 bg-navy-800 rounded animate-pulse mb-3" />
        <div className="h-3 w-full bg-navy-800 rounded animate-pulse" />
      </div>
      <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 mb-4">
        <div className="h-4 w-24 bg-navy-700 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 bg-navy-700 rounded animate-pulse mb-1" />
              <div className="h-5 w-24 bg-navy-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
