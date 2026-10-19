import { Star } from "lucide-react"

/**
 * Read-only stars, filled to the nearest half. Amber regardless of the store's
 * primary color — that's the color shoppers recognise as a rating.
 */
export default function Stars({
  value,
  size = 16,
  className = "",
  label,
}: {
  value: number
  size?: number
  className?: string
  /** Read out instead of five separate icons. */
  label?: string
}) {
  const rounded = Math.round(value * 2) / 2

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={label ?? `${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rounded >= n ? 1 : rounded >= n - 0.5 ? 0.5 : 0
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-gray-300" style={{ width: size, height: size }} strokeWidth={1.5} />
            {fill > 0 && (
              // Clipped from the inline start, so a half star fills from the right in RTL.
              <span className="absolute inset-y-0 inset-s-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star
                  className="fill-amber-400 text-amber-400"
                  style={{ width: size, height: size }}
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}
