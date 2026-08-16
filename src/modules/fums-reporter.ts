import { requestUrl } from 'obsidian'

const FUMS_ENDPOINT = 'https://fums.api.bible/f3'

export type FumsTransport = (url: string) => Promise<string>

const requestUrlTransport: FumsTransport = async (url) =>
  (await requestUrl({ url })).text

export type FumsIds = {
  deviceId: string
  sessionId: string
}

export class FumsReporter {
  constructor(
    private readonly ids: FumsIds,
    private readonly fetchText: FumsTransport = requestUrlTransport,
  ) {}

  async report(fumsToken: string): Promise<void> {
    const query = new URLSearchParams({
      t: fumsToken,
      dId: this.ids.deviceId,
      sId: this.ids.sessionId,
    })
    try {
      await this.fetchText(`${FUMS_ENDPOINT}?${query.toString()}`)
    } catch {
      // FUMS reporting is best-effort; a failed beacon must never surface.
    }
  }
}
