import App from '@koex/core';
import body from '@koex/body';
// import { ProxyClient } from '../src/core/client';
import { createProxy } from '../../src';

declare module '@koex/core' {
  export interface Context {
    // proxy: Proxy;
  }
}

const app = new App();
const proxy = createProxy({
  table: {
    '^/api/httpbin': {
      target: 'https://httpbin.zcorky.com',
      pathRewrite: {
        '^/api/httpbin': '',
      },
    },
    '^/api/github': {
      target: 'https://api.github.com',
      pathRewrite: {
        '^/api/github': '/users'
      },
    },
    '^/api/md5': {
      target: 'https://httpbin.zcorky.com',
      pathRewrite: {
        '^/api': ''
      },
    },
  },
});

app.use(body());

app.use(async (ctx, next) => {
  try {
    const { response } = await proxy({
      path: ctx.path,
      method: ctx.method,
      headers: ctx.headers,
      body: JSON.stringify(ctx.request.body),
      files: ctx.request.files,
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
});

app.get('/api/none-match', async (ctx) => {
  ctx.body = {
    message: 'great, go none match path',
  };
});

app.get('/', async (ctx) => {
  ctx.body = {
    message: 'hello world',
  };
});

(app as any).listen(8080, '0.0.0.0', () => {
  console.log('server start at: http://127.0.0.1:8080');
});