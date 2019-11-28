import { Middleware, Context } from '@koex/core';
import {
  ProxyServer,
  ProxyServerConfig,
  HandShake,
  RequestOptionsFromServer,
} from '@zoproxy/server';

const assert = require('assert');

declare module '@koex/core' {
  export interface Context {
    readonly proxyServer: ProxyServer;
  }
}

export interface Options extends ProxyServerConfig {
  // headers?: RequestOptionsFromServer['headers'] | ((ctx: Context) => Promise<RequestOptionsFromServer['dataHeaders']>);
}

export function createProxyServer(options: Options): Middleware<Context> {
  const proxy = new ProxyServer(options);

  return async (ctx, next) => {
    /**
     * assign proxy
     */
    Object.defineProperty(ctx, 'proxyServer', {
      get() {
        return proxy;
      },
      enumerable: false,
    });

    if (ctx.method !== proxy.config.method && ctx.path !== options.endpoint) {
      return await next();
    }

    assert((ctx.request as any).body, 'ctx.request.body is undefined, make sure you have using body parser middleware.');

    const clientReqestBody = (ctx.request as any).body;

    const response = await proxy.request(clientReqestBody);
  
    ctx.set(response.headers.raw() as any);
    ctx.status = response.status;
    ctx.body = response.body;
  }
}

export default createProxyServer;