// What a grouped nav dropdown renders: flat items under optional group
// headings, each carrying the key its picker navigates by.
export type NavMenuItem = { key: string; label: string; current: boolean }

export type NavMenuGroup = { label: string | null; items: NavMenuItem[] }
