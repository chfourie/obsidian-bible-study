export const uniqueNotePath = (
  folder: string,
  name: string,
  exists: (path: string) => boolean,
): string => {
  const base = `${folder}/${name}`
  let candidate = `${base}.md`
  for (let suffix = 1; exists(candidate); suffix++) {
    candidate = `${base} ${suffix}.md`
  }
  return candidate
}
