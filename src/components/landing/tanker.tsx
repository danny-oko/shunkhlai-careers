/**
 * Shunkhlai road tanker, side view, facing right.
 *
 * Drawn rather than photographed so it can be driven at any size and recoloured
 * from the brand tokens. The livery follows the fleet in the campaign photos:
 * white barrel with an orange band, navy cab-over tractor.
 *
 * `wheelAngle` rotates the hubs; the caller advances it with scroll so the
 * wheels turn at the speed the truck appears to be travelling.
 */
export function Tanker({
  wheelAngle = 0,
  className,
}: {
  wheelAngle?: number;
  className?: string;
}) {
  const axles = [100, 154, 208, 410, 468];

  return (
    <svg
      viewBox="0 0 540 190"
      className={className}
      role="img"
      aria-label="Шунхлайн шатахуун тээвэрлэх цистерн машин"
    >
      {/* Chassis rail, running the length of both units */}
      <rect x="46" y="120" width="454" height="12" rx="3" className="fill-ink" />

      {/* Tank barrel */}
      <rect x="56" y="52" width="330" height="68" rx="34" className="fill-[#f2f3f5]" />
      <rect x="56" y="82" width="330" height="12" className="fill-brand" />
      {[130, 196, 262, 328].map((x) => (
        <rect key={x} x={x} y="52" width="3" height="68" className="fill-ink/12" />
      ))}
      {/* Hazard plate */}
      <rect x="70" y="100" width="30" height="16" rx="2" className="fill-brand-2" />

      {/* Cab-over tractor */}
      <path
        d="M392 122V54c0-6 5-10 10-10h88c6 0 10 4 10 10v68H392Z"
        className="fill-brand-blue"
      />
      <rect x="402" y="56" width="90" height="34" rx="4" className="fill-[#cfe0f2]" />
      <rect x="392" y="98" width="108" height="10" className="fill-brand" />
      {/* Bumper and lamp */}
      <rect x="492" y="108" width="12" height="18" rx="2" className="fill-ink" />
      <rect x="494" y="110" width="8" height="6" rx="1" className="fill-brand-2" />

      {/* Wheels */}
      {axles.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="146" r="24" className="fill-ink" />
          <circle cx={cx} cy="146" r="11" className="fill-[#e7e9ec]" />
          <g transform={`rotate(${wheelAngle} ${cx} 146)`}>
            {[0, 60, 120].map((angle) => (
              <rect
                key={angle}
                x={cx - 1.5}
                y="137"
                width="3"
                height="18"
                rx="1.5"
                className="fill-ink/40"
                transform={`rotate(${angle} ${cx} 146)`}
              />
            ))}
          </g>
        </g>
      ))}
    </svg>
  );
}
