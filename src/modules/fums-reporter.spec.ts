import { describe, expect, it } from 'vitest'
import { FumsReporter } from './fums-reporter'

const recordingTransport = (fail = false) => {
  const urls: string[] = []
  const transport = async (url: string): Promise<string> => {
    urls.push(url)
    if (fail) throw new Error('network down')
    return ''
  }
  return { urls, transport }
}

describe('FumsReporter', () => {
  it('reports a token to the FUMS endpoint with device and session ids', async () => {
    const { urls, transport } = recordingTransport()
    const reporter = new FumsReporter(
      { deviceId: 'device-1', sessionId: 'session-1' },
      transport,
    )

    await reporter.report('the-token')

    expect(urls).toEqual([
      'https://fums.api.bible/f3?t=the-token&dId=device-1&sId=session-1',
    ])
  })

  it('url-encodes token and ids', async () => {
    const { urls, transport } = recordingTransport()
    const reporter = new FumsReporter(
      { deviceId: 'a&b', sessionId: 's=1' },
      transport,
    )

    await reporter.report('t/k+n')

    expect(urls).toEqual([
      'https://fums.api.bible/f3?t=t%2Fk%2Bn&dId=a%26b&sId=s%3D1',
    ])
  })

  it('swallows transport failures so rendering never breaks on FUMS', async () => {
    const { transport } = recordingTransport(true)
    const reporter = new FumsReporter(
      { deviceId: 'device-1', sessionId: 'session-1' },
      transport,
    )

    await expect(reporter.report('the-token')).resolves.toBeUndefined()
  })
})
