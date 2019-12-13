import { Context, Next } from 'koa';
import { createProxy, Options } from '../index';

export function createMiddleware(options: Options) {
  const proxy = createProxy(options);

  return async (ctx: Context, next: Next) => {
    try {
      const { response } = await proxy({
        path: ctx.path,
        method: ctx.method,
        headers: ctx.headers,
        body: JSON.stringify((ctx.request as any).body),
        files: (ctx.request as any).files,
      });
    
      response.headers.delete('content-security-policy');
      ctx.set(response.headers.raw() as any);
      ctx.staus = response.status;
      ctx.body = response.body;
    } catch (error) {
      if (error.status === 404) {
        return next!();
      }
  
      throw error;
    }
  };
}