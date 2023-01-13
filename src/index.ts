import { parse } from 'yaml'
import UAParser from 'ua-parser-js'

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
}

export interface QueryChannel {
  channel?: string
  version?: string
  arch?: 'x64'|'arm64'|'universal'
  platform?: 'windows'|'macos'
}

export interface QueryData {
  version: string
  files: { url: string, sha512: string, size: number }[]
  path: string
  sha512: string
  releaseDate: string
}

const getLauncherLink = async (query: QueryChannel): Promise<string|undefined> => {
  const init = {
    channel: 'alpha',
    platform: 'windows'
  }

  const channel = query.channel || init.channel
  const platform = query.platform || 'windows'
  const endpoint = 'https://mindblock-org.hn.ss.bfcplatform.vn/launcher'
  const arch = query.arch || 'universal'

  const options = {cf:{
    cacheTtl: 60 * 5
  }}

  return fetch(endpoint + `/${channel}${platform === 'macos' ? '-mac' : ''}.yml`, options)
    .then(res => {
      if (res.status === 404) {
        throw new Error('Resource not found')
      }

      return res
    })
    .then(res => res.text())
    .then(text => parse(text) as QueryData)
    .then(({ files, path }) => {
      if (platform === 'windows') return endpoint + `/${path}`

      const url = files.find(file => file.url.includes(arch + '.dmg'))?.url

      return url ? endpoint + `/${url}` : undefined
    }).catch(() => undefined)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const agent = new UAParser(request.headers.get('User-Agent') || '')

    const platform = agent.getOS().name?.toLowerCase() === 'mac os' ? 'macos' : 'windows'

    const query: QueryChannel = {
      channel: url.searchParams.get('channel') || 'alpha',
      platform: url.searchParams.get('platform') as any || platform,
      arch: url.searchParams.get('arch') as any || 'x64',
    }

    const link = await getLauncherLink(query)

    // return new Response(link)

    // redirect to link
    const res = new Response(null, {
      status: 302,
      headers: {
        Location: link!
      }
    })

    return !link ? new Response('Not found', { status: 404 }) : res
  }
}
