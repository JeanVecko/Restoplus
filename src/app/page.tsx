export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-10">
      <div className="mb-8 flex size-16 items-center justify-center rounded-2xl bg-amber-100 text-2xl font-bold text-amber-800">
        R+
      </div>
      <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-amber-800 uppercase">
        Resto+ · RDC
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
        Le socle technique est prêt à évoluer.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
        Cette application est en préparation. Les modules métier seront ajoutés
        par jalons, après validation des règles correspondantes.
      </p>
      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-zinc-700">
          Français · RDC
        </span>
        <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-zinc-700">
          FC / CDF · USD
        </span>
        <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-zinc-700">
          Phase 1 · Squelette technique
        </span>
      </div>
    </main>
  );
}
