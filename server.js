const WS = require('ws');
const http = require('http');
const Koa = require('koa');
const koaBody = require("koa-body");
const app = new Koa();
const Router = require('koa-router');
const router = new Router();
const { v4: uuidv4 } = require('uuid');

app.use(koaBody({
    urlencoded: true,
    multipart: true,
    json: true,
}));

app.use(async (ctx, next) => {
    const origin = ctx.request.get('Origin');
    if (!origin) {
        return await next();
    }
    const headers = { 'Access-Control-Allow-Origin': '*', };

    if (ctx.request.method !== 'OPTIONS') {
        ctx.response.set({...headers});
        try {
            return await next();
        } catch (e) {
            e.headers = {...e.headers, ...headers};
            throw e;
        }
    }

    if (ctx.request.get('Access-Control-Request-Method')) {
        ctx.response.set({
            ...headers,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
        });

        if (ctx.request.get('Access-Control-Request-Headers')) {
            ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
        }
        ctx.response.status = 204;
    }
});

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback()).listen(port);

const wsServer = new WS.Server({ server });
const users = [];
const usersMessages = [];
const date = new Date().toLocaleDateString('ru-RU');

app.use(async ctx => {
    ctx.response.body = 'Ответ сервера';
})

wsServer.on('connection', ws => {

    ws.on('message', msg => {

        const body = JSON.parse(msg);

        if (body.type === 'authorization') {
            if(body.hasOwnProperty('nickname')) {
                if (users.includes(body.nickname)) {
                    body.name = false;
                    ws.send(JSON.stringify({nameStatus: `Пользователь с таким именем уже существует`}));
                } else {
                    users.push(body.nickname);
                    ws.send(JSON.stringify({
                        type: body.type,
                        message: usersMessages,
                    }));

                    wsServer.clients.forEach(client => {
                        if (client.readyState === WS.OPEN) {
                            client.send(JSON.stringify({
                                                                type: body.type,
                                                                usersNames: users,
                            }));
                        }
                    })
                }
            }
        }

        if (body.type === 'message') {

            if (body.hasOwnProperty('textMessage')) {
                usersMessages.push({
                    type: body.type,
                    author: body.user,
                    message: body.textMessage,
                    time: `${new Date().toLocaleTimeString('ru-RU').slice(0, -3)} ${date}`
                });
                wsServer.clients.forEach(client => {
                    if (client.readyState === WS.OPEN) {
                        client.send(JSON.stringify({
                            type: body.type,
                            message: [{
                                author: body.user,
                                message: body.textMessage,
                                time: `${new Date().toLocaleTimeString('ru-RU').slice(0, -3)} ${date}`
                            }]

                        }));
                    }
                })
            }
        }

        if (body.type === 'disconnect') {
            const user = users.indexOf(body.name);
            users.splice(user, 1);
            wsServer.clients.forEach(client => {
                if (client.readyState === WS.OPEN) {
                    client.send(JSON.stringify({
                        type: body.type,
                        usersNames: users,
                    }));
                }
            })
        }
    })
})