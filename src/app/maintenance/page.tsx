import { getMaintenanceState } from '@/lib/maintenance'
import { ReopenCountdown } from './reopen-countdown'
import { MaintenanceHeroImage } from './maintenance-hero-image'

function formatOpenAt(date: Date) {
  return date.toLocaleString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MaintenancePage() {
  const maintenance = getMaintenanceState()
  const hasPlannedOpenAt = maintenance.enabled && maintenance.openAt

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#fffefb_0%,_#fbf2df_38%,_#edf3e3_100%)] px-4 py-10 text-stone-800">
      <div className="pointer-events-none absolute left-[-6rem] top-16 h-52 w-52 rounded-full bg-[#fff2cb]/70 blur-3xl" />
      <div className="pointer-events-none absolute right-[-4rem] top-28 h-56 w-56 rounded-full bg-[#e3f0d2]/80 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-white/70 blur-3xl" />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full items-center gap-10 rounded-[36px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(80,67,36,0.12)] backdrop-blur md:grid-cols-[1.05fr_0.95fr] md:p-10">
          <div className="order-2 text-center md:order-1 md:text-left">
            <span className="inline-flex rounded-full bg-[#eef4e3] px-4 py-2 text-sm font-semibold text-[#4f6b36] shadow-sm">
              Petite pause douceur chez Olive
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-tight text-stone-900 md:text-5xl">
              Oups... je crois que mon maître fait encore de la magie.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
              Pas de panique, je surveille tout. On prend juste un petit moment pour réajuster quelques jolies
              choses et rendre Maison Olive encore plus douce à visiter.
            </p>

            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-500">
              Reviens dans un petit moment. Entre deux coups de patte, tout devrait être prêt très bientôt.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <span className="rounded-full bg-[#fff7e8] px-4 py-2 text-sm font-medium text-[#9a7042] ring-1 ring-[#f3dfba]">
                Inspection canine en cours
              </span>
              <span className="rounded-full bg-[#f4f8ee] px-4 py-2 text-sm font-medium text-[#61784a] ring-1 ring-[#dfe8d0]">
                Aucun bobo technique
              </span>
            </div>

            {hasPlannedOpenAt ? (
              <div className="mt-8 rounded-3xl border border-[#dfe8d0] bg-[#f8fbf2] p-5 text-left shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f8a54]">
                  Réouverture prévue
                </p>
                <p className="mt-2 text-lg font-medium text-stone-800">{formatOpenAt(maintenance.openAt!)}</p>
                <div className="mt-3">
                  <ReopenCountdown openAtIso={maintenance.openAt!.toISOString()} language="fr" />
                </div>
              </div>
            ) : (
              <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#f8fbf2] px-5 py-3 text-sm font-medium text-[#5e7745] shadow-sm ring-1 ring-[#dfe8d0]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#7ea35a]" />
                Olive te rouvre la porte très bientôt
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <a
                href="/login"
                className="inline-flex items-center rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-600 transition hover:border-stone-400 hover:text-stone-800"
              >
                Accès admin
              </a>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="relative mx-auto max-w-[430px]">
              <div className="absolute -left-3 top-2 z-10 max-w-[220px] rounded-[24px] rounded-bl-md bg-white px-4 py-3 text-left text-sm leading-6 text-stone-600 shadow-[0_18px_35px_rgba(90,72,39,0.14)] ring-1 ring-stone-100 md:left-0">
                <strong className="block text-base text-stone-800">Petit mot d&apos;Olive</strong>
                Je garde la boutique pendant que mon maître replace quelques coussins.
              </div>

              <div className="absolute -right-2 bottom-8 z-10 rounded-full bg-[#fff8ea] px-4 py-2 text-sm font-semibold text-[#9a7042] shadow-sm ring-1 ring-[#f3dfba]">
                Retour bientôt
              </div>

              <div className="relative rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,226,0.95))] p-4 pt-16 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:pt-14">
              <div className="absolute inset-4 -z-10 rounded-[28px] bg-[radial-gradient(circle,_rgba(255,255,255,0.95)_0%,_rgba(235,244,224,0.55)_60%,_transparent_100%)] blur-2xl" />
                <MaintenanceHeroImage alt="Bouledogue souriant pour la page de maintenance Maison Olive" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
