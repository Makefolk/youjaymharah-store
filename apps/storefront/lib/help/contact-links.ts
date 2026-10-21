/** wa.me wants the number with no + or spaces. */
export const whatsappUrl = (number: string) =>
  `https://wa.me/${number.replace(/\D/g, "")}`

/** +2348012345678 as "+234 801 234 5678", the way Nigerian numbers are read. */
export function formatPhone(number: string): string {
  const match = number.match(/^\+234(\d{3})(\d{3})(\d{4})$/)
  return match ? `+234 ${match[1]} ${match[2]} ${match[3]}` : number
}
