import { joinNotePath } from './note-path'

export const uniqueNotePath = (
  folder: string,
  name: string,
  exists: (path: string) => boolean,
): string => {
  let candidate = joinNotePath(folder, name)
  for (let suffix = 1; exists(candidate); suffix++) {
    candidate = joinNotePath(folder, `${name} ${suffix}`)
  }
  return candidate
}
