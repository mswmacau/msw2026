/**
 * 全站載入中畫面：App Router 會在任何子路由等待伺服器資料時顯示這個骨架，
 * 避免「按了沒反應、畫面空白」的感覺。
 */
export default function Loading() {
  return (
    <div className="container-msw animate-fade-in pb-24 pt-36">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-white/10" />
      <div className="mt-5 h-4 w-2/3 max-w-xl animate-pulse rounded bg-white/5" />
      <div className="mt-4 h-4 w-1/2 max-w-md animate-pulse rounded bg-white/5" />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-2xl border border-white/5 bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}
