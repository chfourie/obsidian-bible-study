export interface CrossReferenceVault {
  read(path: string): Promise<string | null>
  write(path: string, content: string): Promise<void>
}
