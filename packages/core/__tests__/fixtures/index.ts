import App from '@koex/core';
import body from '@koex/body';
// import { ProxyClient } from '../src/core/client';
import { Proxy } from '../../src';

declare module '@koex/core' {
  export interface Context {
    proxy: Proxy;
  }
}

const app = new App();

app.use(body());

app.use((() => {
  const proxy = new Proxy({
    // target: 'https://httpbin.zcorky.com',
    // enableDynamicTarget: true,
  });

  return async (ctx, next) => {
    ctx.proxy = proxy;
  
    await next();
  };
})());

app.use(async (ctx, next) => {
  if (!ctx.path.startsWith('/api')) {
    return next();
  }

  const response = await ctx.proxy.request({
    method: ctx.method,
    path: ctx.path.replace('/api', ''),
    headers: ctx.headers,
    body: ctx.request.body,
  });

  ctx.set(response.headers.raw() as any);
  ctx.body = response.body;
});

app.get('/github/:username', async (ctx) => {
  const { response } = await ctx.proxy.request({
    target: 'https://httpbin.zcorky.com',
    method: ctx.method,
    path: `/users/${ctx.params.username}`,
    headers: ctx.headers,
    body: ctx.request.body,
  });

  ctx.set(response.headers.raw() as any);
  ctx.body = response.body;
});

app.get('/md5/:value', async (ctx) => {
  const { response } = await ctx.proxy.request({
    target: 'https://httpbin.zcorky.com',
    method: ctx.method,
    path: `/md5/${ctx.params.value}`,
    headers: ctx.headers,
    body: ctx.request.body,
  });

  ctx.set(response.headers.raw() as any);
  ctx.body = response.body;
});

app.get('/zcorky/(.*)', async (ctx) => {
  const { response } = await ctx.proxy.request({
    target: 'https://httpbin.zcorky.com',
    method: ctx.method,
    path: ctx.path.replace('/zcorky', ''),
    headers: ctx.headers,
    body: ctx.request.body,
  });

  ctx.set(response.headers.raw() as any);
  ctx.body = response.body;
});


// app.use(async (ctx, next) => {
//   if (!ctx.path.startsWith('/api')) {
//     return await next();
//   }

//   // console.log(JSON.stringify(ctx.headers));
//   const response = await proxy.request({
//     method: ctx.method,
//     path: ctx.path.replace('/api', ''),
//     headers: ctx.headers,
//     body: ctx.request.body,
//   }, {
//     handshake: {
//       appId: 'app-claim',
//       appToken: '6666666',
//       timestamps: +new Date(),
//     },
//   });

//   // ctx.set(response.);
//   ctx.set(response.headers.raw() as any);
//   ctx.body = response.body;
// });

app.get('/', async (ctx) => {
  ctx.body = {
    message: 'hello world',
  };
});

(app as any).listen(8080, '0.0.0.0', () => {
  console.log('server start at: http://127.0.0.1:8080');
});