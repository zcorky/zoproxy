import App from '@koex/core';
import body from '@koex/body';
// import { proxyClient } from '../src/core/client';
import { createProxyServer } from '../../src/koex';

const app = new App();

app.use(body());

app.use(createProxyServer({
  target: 'https://httpbin.zcorky.com',
  method: 'POST',
  endpoint: '/proxy',
  //
  onHandShake: async (handshake) => {
    console.log('handshake: ', handshake);
    const validated = handshake && handshake.appId === 'app-id' && handshake.appToken === 'app-token';

    if (!validated) {
        const error = new Error('Forbidden') as any;
        error.status = 403;
        throw error;
    }

    console.log('handshake successfully');
  },

  enableDynamicTarget: true,
}));

app.use(async (ctx, next) => {
  if (!ctx.path.startsWith('/api')) {
    return next();
  }

  const response = await ctx.proxyClient.request(ctx.request.body);

  ctx.set(response.headers.raw() as any);
  ctx.status = response.status;
  ctx.body = response.body;
});

app.get('/github/:username', async (ctx) => {
  const response = await ctx.proxyClient.request({
    method: ctx.method,
    path: `/users/${ctx.params.username}`,
    headers: ctx.headers,
    body: ctx.request.body,
  }, {
    target: 'https://api.github.com',
    handshake: {
      appId: 'app-id',
      appToken: 'app-token',
      timestamps: +new Date(),
    },
  });

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