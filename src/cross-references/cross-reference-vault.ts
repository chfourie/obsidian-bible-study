export interface CrossReferenceVault {
  read(path: string): Promise<string | null>
}
