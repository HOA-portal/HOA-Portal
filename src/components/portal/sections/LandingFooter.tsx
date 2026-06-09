export function LandingFooter() {
  return (
    <footer className="bg-slate-950 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">TC</span>
            </div>
            <span className="text-white font-semibold text-sm">Tara Cay Sound</span>
          </div>
          <p className="text-slate-500 text-xs">
            Powered by{' '}
            <span className="text-slate-400 font-medium">HOA Portal</span>
          </p>
        </div>

        <p className="text-slate-500 text-xs max-w-sm md:text-right leading-relaxed">
          Buyer Notice: All information is subject to change and should be verified
          prior to entering into any purchase contract.
        </p>
      </div>
    </footer>
  )
}
