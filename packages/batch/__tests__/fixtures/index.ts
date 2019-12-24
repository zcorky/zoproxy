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
    '/api/httpbin': {
      target: 'https://httpbin.zcorky.com',
      pathRewrite: {
        '^/api/httpbin': '',
      },
      env: {
        prd: {
          target: 'http://httpbin.org',
          pathRewrite: {},
        },
      },
    },
    '/api/github': {
      target: 'https://api.github.com',
      pathRewrite: {
        '^/api/github': '/users'
      },
    },
    '/api/md5': {
      target: 'https://httpbin.zcorky.com',
      pathRewrite: {
        '^/api': ''
      },
    },
  },
  env: process.env.DEPLOY_ENV,
});

app.use(body({
  enableTypes: ['json', 'form-data', 'multipart', 'text'] as any,
}));

app.use(async (ctx, next) => {
  try {
    const { response } = await proxy({
      path: ctx.path,
      method: ctx.method,
      headers: ctx.headers,
      // query: ctx.query,
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

const PORT = process.env.PORT || 8080;

(app as any).listen(PORT, '0.0.0.0', () => {
  console.log('server start at: http://127.0.0.1:' + PORT);
});