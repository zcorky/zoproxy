import App from '@koex/core';
import body from '@koex/body';
// import { ProxyServer } from '../src/core/client';
import { ProxyServer } from '../../src';

declare module '@koex/core' {
  export interface Context {
    proxyServer: ProxyServer;
  }
}

const app = new App();

app.use(body());

app.use((() => {
  const proxy = new ProxyServer({
    target: 'http://httpbin.zcorky.com',
    method: 'POST',
    endpoint: '/proxy',
    enableDynamicTarget: true,
    async onHandShake(handshake) {
      console.log('handshake: ', handshake);
      const validated = handshake && handshake.appId === 'app-id' && handshake.appToken === 'app-token';
  
      if (!validated) {
          const error = new Error('Forbidden') as any;
          error.status = 403;
          throw error;
      }
  
      console.log('handshake successfully');
    },
  });

  return async (ctx, next) => {
    ctx.proxyServer = proxy;
  
    await next();
  };
})());

app.use(async (ctx, next) => {
  if (!ctx.path.startsWith('/api')) {
    return next();
  }

  const response = await ctx.proxyServer.request(ctx.request.body);

  ctx.set(response.headers.raw() as any);
  ctx.status = response.status;
  ctx.body = response.body;
});

app.post('/proxy', async (ctx) => {
  const response = await ctx.proxyServer.request(ctx.request.body);

  ctx.set(response.headers.raw() as any);
  ctx.status = response.status;
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

(app as any).listen(8090, '0.0.0.0', () => {
  console.log('server start at: http://127.0.0.1:8090');
});