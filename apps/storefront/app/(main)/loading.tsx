/**
 * Shown while a page's data loads on navigation. Deliberately quiet: a thin
 * bar under the header rather than a spinner, so quick loads don't flash.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="relative h-0.5 overflow-hidden"
    >
      <div className="absolute inset-y-0 w-1/3 animate-[loading_1.2s_ease-in-out_infinite] bg-gold motion-reduce:animate-none" />
    </div>
  )
}
