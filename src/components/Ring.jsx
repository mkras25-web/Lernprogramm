// Fortschrittsring. Groesse und Staerke sind frei, damit derselbe Ring
// als grosser Levelanzeiger und als kleines Modulzeichen dient.
export default function Ring({ anteil, groesse = 72, staerke = 6, beschriftung, unten }) {
  const radius = (groesse - staerke) / 2
  const umfang = 2 * Math.PI * radius
  const gefuellt = Math.max(0, Math.min(1, anteil)) * umfang

  return (
    <div className="ring" style={{ width: groesse }}>
      <svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`}>
        <circle
          cx={groesse / 2}
          cy={groesse / 2}
          r={radius}
          fill="none"
          stroke="var(--linie)"
          strokeWidth={staerke}
        />
        <circle
          cx={groesse / 2}
          cy={groesse / 2}
          r={radius}
          fill="none"
          stroke="var(--fortschritt)"
          strokeWidth={staerke}
          strokeLinecap="round"
          strokeDasharray={`${gefuellt} ${umfang}`}
          transform={`rotate(-90 ${groesse / 2} ${groesse / 2})`}
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
        {beschriftung && (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="ringWert"
            fontSize={groesse / 3.2}
          >
            {beschriftung}
          </text>
        )}
      </svg>
      {unten && <p className="ringUnten">{unten}</p>}
    </div>
  )
}
