import Image from "next/image";

/** Natural size of the artwork, which every figure below is a share of. */
const ART = { width: 2043, height: 770 };

/** Where the tyres sit, as a share of the file's height. */
export const TANKER_BASE_GAP = 0.125;

/** Wheel radius, as a share of the artwork's width. */
export const TANKER_WHEEL_RADIUS = 67 / ART.width;

/**
 * Wheel centres, measured off the artwork.
 *
 * The tyres are circles tangent to the ground, so their geometry falls out of
 * two chords: the contact run at y=665 and the wider one at y=620 give a
 * centre line of y=604 and a radius of 69. The rotating disc is cut one pixel
 * inside that, at 67, which keeps the anti-aliased outer edge of the original
 * tyre in place underneath.
 */
const WHEELS = [293, 475, 656, 835, 1311, 1804].map((cx) => ({
  cx,
  left: ((cx - 67) / ART.width) * 100,
}));

const WHEEL_TOP = ((604 - 67) / ART.height) * 100;
const WHEEL_SIZE = ((67 * 2) / ART.width) * 100;

/**
 * The client's own tanker, side on, facing right.
 *
 * The artwork is a flat cut-out, so the wheels are lifted out of it as one
 * disc (`tsestern-wheel.png`, cut from a middle trailer wheel) and laid back
 * over each hub. Each copy is opaque and exactly covers the tyre beneath it,
 * so turning it turns the wheel with no seam.
 *
 * About an eighth of the file's height is empty below the tyres;
 * `TANKER_BASE_GAP` is that gap, so the caller can drop the truck onto the
 * road without guessing.
 */
export function Tanker({
  wheelAngle = 0,
  className,
}: {
  wheelAngle?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="relative">
        <Image
          src="/brand/tsestern.png"
          alt="Шунхлайн шатахуун тээвэрлэх цистерн машин"
          width={ART.width}
          height={ART.height}
          sizes="(max-width: 1024px) 92vw, 86vw"
          className="h-auto w-full"
        />

        {WHEELS.map((wheel) => (
          <div
            key={wheel.cx}
            aria-hidden
            className="absolute"
            style={{
              left: `${wheel.left}%`,
              top: `${WHEEL_TOP}%`,
              width: `${WHEEL_SIZE}%`,
              transform: `rotate(${wheelAngle}deg)`,
            }}
          >
            <Image
              src="/brand/tsestern-wheel.png"
              alt=""
              width={134}
              height={134}
              sizes="8vw"
              className="h-auto w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
