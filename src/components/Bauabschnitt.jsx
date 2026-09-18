import { bauwerkFuer } from '../lib/stufen.js'

// Das Levelicon. Ein Gebaeudeschnitt, der mit jeder Stufe ein Bauteil
// dazubekommt. Die Teile stehen je Bauwerk in einer Liste mit der
// Stufe, ab der sie sichtbar sind - ein neues Bauwerk heisst: eine
// Teileliste anhaengen, nicht die Zeichenlogik anfassen.
//
// Alle Farben kommen aus dem Stylesheet, damit das Icon mit der
// gewaehlten Palette mitzieht. "bis" blendet Teile wieder aus, die
// spaeter verschwinden - etwa das Schnurgeruest.

const T = 'var(--tusche)'
const R = 'var(--rinde)'
const L = 'var(--lehm)'
const A = 'var(--akzent)'

// ================================================ Bauwerk I: Wohnhaus
const WOHNHAUS = [
  { ab: 1, el: <line x1="6" y1="72" x2="94" y2="72" stroke={T} strokeWidth="1.4" /> },
  { ab: 2, el: <path d="M22 72 L28 84 H72 L78 72" fill="none" stroke={R} strokeWidth="1.1" /> },
  { ab: 3, el: <path d="M28 84 H72" stroke={L} strokeWidth="2.4" /> },
  { ab: 4, el: <g stroke={R} strokeWidth="0.7" opacity="0.7"><path d="M23 74 l3 3 M26 73 l3 4 M71 77 l3 -4 M74 78 l3 -4" /></g> },
  { ab: 5, bis: 10, el: <g stroke={R} strokeWidth="0.7"><path d="M16 66 h10 M21 62 v10 M74 66 h10 M79 62 v10" /></g> },

  { ab: 6, el: <rect x="28" y="80" width="44" height="2" fill={R} /> },
  { ab: 7, el: <g fill={L}><rect x="28" y="74" width="7" height="7" /><rect x="65" y="74" width="7" height="7" /></g> },
  { ab: 8, el: <rect x="28" y="72" width="44" height="3" fill={L} /> },
  { ab: 9, el: <g stroke={T} strokeWidth="0.6" opacity="0.8"><path d="M31 72 v3 M38 72 v3 M45 72 v3 M52 72 v3 M59 72 v3 M66 72 v3" /></g> },
  { ab: 10, el: <rect x="27" y="69" width="46" height="3" fill={R} /> },

  { ab: 11, el: <g fill={L}><rect x="27" y="60" width="5" height="9" /><rect x="68" y="60" width="5" height="9" /></g> },
  { ab: 12, el: <g fill={L}><rect x="27" y="52" width="5" height="8" /><rect x="68" y="52" width="5" height="8" /></g> },
  { ab: 13, el: <rect x="32" y="52" width="36" height="17" fill={L} opacity="0.45" /> },
  { ab: 14, el: <g fill="var(--papier)" stroke={T} strokeWidth="0.6"><rect x="37" y="56" width="9" height="9" /><rect x="54" y="56" width="9" height="9" /></g> },
  { ab: 15, el: <g stroke={T} strokeWidth="0.7"><path d="M36 55 h11 M53 55 h11" /></g> },

  { ab: 16, el: <rect x="25" y="49" width="50" height="3" fill={R} /> },
  { ab: 17, el: <g fill={L}><rect x="27" y="41" width="5" height="8" /><rect x="68" y="41" width="5" height="8" /></g> },
  { ab: 18, el: <rect x="32" y="41" width="36" height="8" fill={L} opacity="0.45" /> },
  { ab: 19, el: <g fill="var(--papier)" stroke={T} strokeWidth="0.6"><rect x="37" y="43" width="9" height="6" /><rect x="54" y="43" width="9" height="6" /></g> },
  { ab: 20, el: <rect x="25" y="38" width="50" height="3" fill={R} /> },

  { ab: 21, el: <path d="M24 38 L50 20 L76 38" fill="none" stroke={T} strokeWidth="1.4" /> },
  { ab: 22, el: <path d="M50 20 v18" stroke={R} strokeWidth="0.9" /> },
  { ab: 23, el: <g stroke={R} strokeWidth="0.7"><path d="M33 31 v7 M41 25 v13 M59 25 v13 M67 31 v7" /></g> },
  { ab: 24, el: <path d="M30 34 H70" stroke={R} strokeWidth="0.7" /> },
  { ab: 25, el: <path d="M24 38 H76" stroke={T} strokeWidth="0.9" /> },

  { ab: 26, el: <path d="M24 38 L50 20 L76 38 Z" fill={A} opacity="0.55" /> },
  { ab: 27, el: <g stroke={T} strokeWidth="0.5" opacity="0.8"><path d="M29 35 h42 M34 31 h32 M39 27 h22 M44 23 h12" /></g> },
  { ab: 28, el: <path d="M21 39 H79" stroke={T} strokeWidth="1.2" /> },
  { ab: 29, el: <rect x="60" y="22" width="5" height="11" fill={R} /> },
  { ab: 30, el: <rect x="59" y="21" width="7" height="2" fill={T} /> },

  { ab: 31, el: <g stroke={T} strokeWidth="0.5"><path d="M41.5 56 v9 M37 60.5 h9 M58.5 56 v9 M54 60.5 h9" /></g> },
  { ab: 32, el: <g stroke={T} strokeWidth="0.5"><path d="M41.5 43 v6 M37 46 h9 M58.5 43 v6 M54 46 h9" /></g> },
  { ab: 33, el: <rect x="46" y="59" width="8" height="10" fill={R} stroke={T} strokeWidth="0.5" /> },
  { ab: 34, el: <circle cx="52" cy="64" r="0.8" fill="var(--papier)" /> },
  { ab: 35, el: <path d="M50 49 v-8" stroke={R} strokeWidth="0.5" opacity="0.6" /> },

  { ab: 36, el: <rect x="32" y="52" width="36" height="17" fill={L} opacity="0.75" /> },
  { ab: 37, el: <rect x="32" y="41" width="36" height="8" fill={L} opacity="0.75" /> },
  { ab: 38, el: <rect x="25" y="66" width="50" height="3" fill={R} /> },
  { ab: 39, el: <g fill={T}><rect x="36" y="65" width="11" height="1" /><rect x="53" y="65" width="11" height="1" /></g> },
  { ab: 40, el: <g stroke={T} strokeWidth="0.35" opacity="0.45"><path d="M27 57 h46 M27 62 h46 M27 45 h46" /></g> },

  { ab: 41, el: <path d="M6 72 H94" stroke={T} strokeWidth="2" /> },
  { ab: 42, el: <g><path d="M14 72 v-7" stroke={R} strokeWidth="1" /><circle cx="14" cy="62" r="4.5" fill={A} opacity="0.7" /></g> },
  { ab: 43, el: <g><path d="M86 72 v-6" stroke={R} strokeWidth="1" /><circle cx="86" cy="63" r="4" fill={A} opacity="0.7" /></g> },
  { ab: 44, el: <path d="M46 72 v6 M54 72 v6" stroke={R} strokeWidth="0.7" /> },
  { ab: 45, el: <g stroke={T} strokeWidth="0.7" fill="none"><path d="M8 88 h30 v8 H8 Z M8 92 h30" /></g> },

  { ab: 46, el: <circle cx="14" cy="60" r="7" fill={A} opacity="0.75" /> },
  { ab: 47, el: <path d="M20 78 q30 -6 60 0" fill="none" stroke={R} strokeWidth="0.6" opacity="0.6" /> },
  { ab: 48, el: <circle cx="86" cy="61" r="6" fill={A} opacity="0.75" /> },
  { ab: 49, el: <g stroke={R} strokeWidth="0.5" opacity="0.7"><path d="M64 70 h8 M64 67 h8" /></g> },
  { ab: 50, el: <path d="M42 96 h16" stroke={T} strokeWidth="1.6" /> },
]

// =============================================== Bauwerk II: Stadthaus
// Breiter, dreigeschossig, Mansarddach, Mittelrisalit mit Freitreppe.
// Dieselbe Bauabfolge, andere Silhouette.
const STADTHAUS = [
  { ab: 1, el: <line x1="4" y1="74" x2="96" y2="74" stroke={T} strokeWidth="1.4" /> },
  { ab: 2, el: <path d="M14 74 L20 88 H80 L86 74" fill="none" stroke={R} strokeWidth="1.1" /> },
  { ab: 3, el: <path d="M20 88 H80" stroke={L} strokeWidth="2.6" /> },
  { ab: 4, el: <g stroke={R} strokeWidth="0.7" opacity="0.7"><path d="M15 76 l3 4 M18 75 l3 5 M79 80 l3 -5 M82 81 l3 -5" /></g> },
  { ab: 5, bis: 10, el: <g stroke={R} strokeWidth="0.7"><path d="M6 68 h10 M11 64 v10 M84 68 h10 M89 64 v10" /></g> },

  { ab: 6, el: <rect x="20" y="84" width="60" height="2" fill={R} /> },
  { ab: 7, el: <g fill={L}><rect x="20" y="77" width="8" height="8" /><rect x="46" y="77" width="8" height="8" /><rect x="72" y="77" width="8" height="8" /></g> },
  { ab: 8, el: <rect x="20" y="74" width="60" height="4" fill={L} /> },
  { ab: 9, el: <g stroke={T} strokeWidth="0.5" opacity="0.8"><path d="M26 74 v4 M34 74 v4 M42 74 v4 M50 74 v4 M58 74 v4 M66 74 v4 M74 74 v4" /></g> },
  { ab: 10, el: <rect x="18" y="70" width="64" height="4" fill={R} /> },

  { ab: 11, el: <g fill={L}><rect x="18" y="60" width="6" height="10" /><rect x="76" y="60" width="6" height="10" /></g> },
  { ab: 12, el: <rect x="24" y="60" width="52" height="10" fill={L} opacity="0.45" /> },
  { ab: 13, el: <rect x="18" y="52" width="64" height="8" fill={L} opacity="0.45" /> },
  { ab: 14, el: <g fill="var(--papier)" stroke={T} strokeWidth="0.55"><rect x="26" y="61" width="8" height="8" /><rect x="39" y="61" width="8" height="8" /><rect x="53" y="61" width="8" height="8" /><rect x="66" y="61" width="8" height="8" /></g> },
  { ab: 15, el: <rect x="40" y="52" width="20" height="18" fill={L} opacity="0.7" /> },

  { ab: 16, el: <rect x="16" y="49" width="68" height="3" fill={R} /> },
  { ab: 17, el: <rect x="18" y="39" width="64" height="10" fill={L} opacity="0.45" /> },
  { ab: 18, el: <g fill="var(--papier)" stroke={T} strokeWidth="0.55"><rect x="26" y="41" width="8" height="7" /><rect x="39" y="41" width="8" height="7" /><rect x="53" y="41" width="8" height="7" /><rect x="66" y="41" width="8" height="7" /></g> },
  { ab: 19, el: <rect x="16" y="36" width="68" height="3" fill={R} /> },
  { ab: 20, el: <rect x="40" y="33" width="20" height="16" fill={L} opacity="0.7" /> },

  { ab: 21, el: <path d="M18 36 L26 26 H74 L82 36" fill="none" stroke={T} strokeWidth="1.3" /> },
  { ab: 22, el: <path d="M26 26 L40 18 H60 L74 26" fill="none" stroke={T} strokeWidth="1.3" /> },
  { ab: 23, el: <g stroke={R} strokeWidth="0.6"><path d="M32 26 v10 M44 26 v10 M56 26 v10 M68 26 v10" /></g> },
  { ab: 24, el: <path d="M40 18 H60" stroke={R} strokeWidth="0.9" /> },
  { ab: 25, el: <path d="M18 36 H82" stroke={T} strokeWidth="0.9" /> },

  { ab: 26, el: <path d="M18 36 L26 26 H74 L82 36 Z" fill={A} opacity="0.5" /> },
  { ab: 27, el: <path d="M26 26 L40 18 H60 L74 26 Z" fill={A} opacity="0.35" /> },
  { ab: 28, el: <g stroke={T} strokeWidth="0.45" opacity="0.75"><path d="M22 33 h56 M25 30 h50 M30 23 h40 M35 20 h30" /></g> },
  { ab: 29, el: <path d="M15 37 H85" stroke={T} strokeWidth="1.2" /> },
  { ab: 30, el: <g fill={R}><rect x="30" y="20" width="5" height="9" /><rect x="65" y="20" width="5" height="9" /></g> },

  { ab: 31, el: <g fill="var(--papier)" stroke={T} strokeWidth="0.5"><path d="M44 31 h12 v-5 l-6 -4 l-6 4 Z" /></g> },
  { ab: 32, el: <g stroke={T} strokeWidth="0.45"><path d="M30 61 v8 M26 65 h8 M43 61 v8 M39 65 h8 M57 61 v8 M53 65 h8 M70 61 v8 M66 65 h8" /></g> },
  { ab: 33, el: <g stroke={T} strokeWidth="0.45"><path d="M30 41 v7 M26 44.5 h8 M43 41 v7 M39 44.5 h8 M57 41 v7 M53 44.5 h8 M70 41 v7 M66 44.5 h8" /></g> },
  { ab: 34, el: <path d="M44 70 v-11 a6 6 0 0 1 12 0 v11 Z" fill={R} stroke={T} strokeWidth="0.5" /> },
  { ab: 35, el: <g fill="var(--papier)"><circle cx="53" cy="65" r="0.9" /><path d="M46 56 h8" /></g> },

  { ab: 36, el: <g fill={L} opacity="0.8"><rect x="18" y="52" width="64" height="18" /><rect x="18" y="39" width="64" height="10" /></g> },
  { ab: 37, el: <rect x="40" y="33" width="20" height="37" fill={L} opacity="0.9" /> },
  { ab: 38, el: <g fill={R}><rect x="16" y="49" width="68" height="3" /><rect x="16" y="36" width="68" height="3" /></g> },
  { ab: 39, el: <g fill={T}><rect x="25" y="69" width="10" height="1" /><rect x="38" y="69" width="10" height="1" /><rect x="52" y="69" width="10" height="1" /><rect x="65" y="69" width="10" height="1" /></g> },
  { ab: 40, el: <g stroke={T} strokeWidth="0.3" opacity="0.4"><path d="M18 57 h64 M18 65 h64 M18 44 h64" /></g> },

  { ab: 41, el: <path d="M4 74 H96" stroke={T} strokeWidth="2.2" /> },
  { ab: 42, el: <g stroke={R} strokeWidth="0.8" fill="none"><path d="M42 74 h16 M41 77 h18 M40 80 h20" /></g> },
  { ab: 43, el: <g><path d="M10 74 v-8" stroke={R} strokeWidth="1.1" /><circle cx="10" cy="63" r="5" fill={A} opacity="0.7" /></g> },
  { ab: 44, el: <g><path d="M90 74 v-7" stroke={R} strokeWidth="1.1" /><circle cx="90" cy="64" r="4.5" fill={A} opacity="0.7" /></g> },
  { ab: 45, el: <g stroke={T} strokeWidth="0.7" fill="none"><path d="M6 88 h34 v9 H6 Z M6 92.5 h34 M23 88 v9" /></g> },

  { ab: 46, el: <g stroke={R} strokeWidth="0.6" opacity="0.7"><path d="M14 82 h72" /></g> },
  { ab: 47, el: <circle cx="10" cy="61" r="7.5" fill={A} opacity="0.75" /> },
  { ab: 48, el: <circle cx="90" cy="62" r="6.5" fill={A} opacity="0.75" /> },
  { ab: 49, el: <g fill={A} opacity="0.5"><circle cx="24" cy="71" r="2.5" /><circle cx="76" cy="71" r="2.5" /></g> },
  { ab: 50, el: <path d="M38 97 h24" stroke={T} strokeWidth="1.8" /> },
]

const TEILE_JE_WERK = { 1: WOHNHAUS, 2: STADTHAUS }

function Rahmen({ art }) {
  const s = { fill: 'none', stroke: 'var(--rinde)' }
  switch (art) {
    case 'linie':
      return <rect x="2" y="2" width="96" height="96" rx="2" {...s} strokeWidth="1" />
    case 'doppel':
      return (
        <g {...s} strokeWidth="1">
          <rect x="1.5" y="1.5" width="97" height="97" rx="2" />
          <rect x="5" y="5" width="90" height="90" rx="1" />
        </g>
      )
    case 'winkel':
      return <g {...s} strokeWidth="1.6" strokeLinecap="square"><path d="M2 14 V2 h12 M86 2 h12 v12 M98 86 v12 h-12 M14 98 H2 V86" /></g>
    case 'plankopf':
      return (
        <g {...s} strokeWidth="1.2">
          <rect x="2" y="2" width="96" height="96" />
          <path d="M2 88 h96 M62 88 V98" />
        </g>
      )
    case 'stempel':
      return (
        <g {...s}>
          <rect x="2" y="2" width="96" height="96" rx="3" strokeWidth="1.4" />
          <rect x="6" y="6" width="88" height="88" rx="2" strokeWidth="0.8" strokeDasharray="3 2" />
        </g>
      )
    case 'siegel':
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="48.5" strokeWidth="1.6" />
          <circle cx="50" cy="50" r="44.5" strokeWidth="0.7" strokeDasharray="2 2" />
        </g>
      )
    default:
      return null
  }
}

export default function Bauabschnitt({ stufe = 1, groesse = 96, titel = true, marke = true }) {
  const b = bauwerkFuer(stufe)
  const teile = TEILE_JE_WERK[b.werkNr] ?? WOHNHAUS
  const sichtbar = teile.filter((t) => t.ab <= b.imWerk && (t.bis === undefined || b.imWerk <= t.bis))
  const letzte = sichtbar.length ? sichtbar[sichtbar.length - 1].ab : 0

  return (
    <div className={`bauabschnitt grund-${b.grund} rahmen-${b.rahmen}`}>
      <svg
        width={groesse}
        height={groesse}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${b.werk.name}, ${b.abschnitt.name}, Stufe ${stufe}`}
      >
        <rect className="bauGrund" x="0" y="0" width="100" height="100" rx="3" />
        <Rahmen art={b.rahmen} />
        <g className="bauTeile">
          {sichtbar.map((t) => (
            <g key={t.ab} className={t.ab === letzte ? 'bauTeil neu' : 'bauTeil'}>{t.el}</g>
          ))}
        </g>
        {marke && b.werkNr > 1 && (
          <text className="bauWerkmarke" x="8" y="15">{b.werk.marke}</text>
        )}
        <text className="bauStufe" x="92" y="15" textAnchor="end">{stufe}</text>
      </svg>

      {titel && (
        <p className="bauName">
          {b.abschnitt.name}
          <span className="bauPunkte" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= b.imAbschnitt ? 'bauPunkt voll' : 'bauPunkt'} />
            ))}
          </span>
        </p>
      )}
    </div>
  )
}
