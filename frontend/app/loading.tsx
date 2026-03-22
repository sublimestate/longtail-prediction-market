export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8">
        <div className="h-8 w-48 bg-navy-800 rounded animate-pulse" />
        <div className="h-10 w-36 bg-navy-800 rounded-lg animate-pulse" />
      </header>
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-16 bg-navy-800 rounded-full animate-pulse" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-navy-800 border border-navy-700 rounded-lg p-4">
            <div className="h-5 w-3/4 bg-navy-700 rounded animate-pulse mb-3" />
            <div className="h-4 w-1/3 bg-navy-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}
