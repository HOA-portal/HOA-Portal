import Image from 'next/image'

export function ExperienceSection() {
  return (
    <section className="bg-white py-24 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        {/* Left: copy */}
        <div>
          <p className="text-teal-700 text-xs font-semibold tracking-[0.2em] uppercase mb-4">
            Experience Tara Cay
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-slate-900 leading-tight">
            More than a home.<br />A lifestyle.
          </h2>
          <p className="text-lg text-slate-500 mt-6 leading-relaxed">
            Imagine waking up just steps from the Intracoastal Waterway, enjoying the gulf breeze
            and the peace of a community with no through traffic. Tara Cay offers the feel of a
            single-family home with the convenience of resort-style amenities. Whether you&apos;re
            looking for your next home or accessing community services, you&apos;re in the right place.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              'No through traffic — a private, peaceful community',
              'Resort-style living at HOA fees that make sense',
              'Waterfront access steps from your front door',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-teal-50 flex items-center justify-center">
                  <svg className="w-3 h-3 text-teal-600" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-slate-600 text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex gap-4">
            <a
              href="#contact"
              className="inline-flex px-6 py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-600 transition-colors"
            >
              View Available Units
            </a>
            <a
              href="#resident"
              className="inline-flex px-6 py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:border-teal-300 hover:text-teal-700 transition-colors"
            >
              Resident Portal
            </a>
          </div>
        </div>

        {/* Right: image */}
        <div>
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl bg-slate-200">
            <Image
              src="/images/tara-cay/entrance.jpg"
              alt="Tara Cay Sound entrance"
              fill
              className="object-cover"
            />
          </div>
          <p className="text-slate-400 text-xs mt-3 text-center tracking-wide">
            Tara Cay Sound · Seminole, FL
          </p>
        </div>
      </div>
    </section>
  )
}
