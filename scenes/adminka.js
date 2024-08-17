const Scene = require('telegraf/scenes/base');

const messages = require('../scripts/messages');
const middlewares = require('../scripts/middlewares');

const {
    userDBService,
    carDBService,
    serviceDBService
} = require('../services/db');
const { sender } = require('../services/sender');

function adminPanel() {
    const adminka = new Scene('adminka');

    adminka.use(middlewares.start);

    adminka.enter(async (ctx) => {
        const { user } = ctx.state;

        const message = messages.adminPanel(user.lang);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    adminka.hears(/admin ([0-9A-Za-z_]+)/, async (ctx) => {
        const { user } = ctx.state;

        const match = ctx.match[1];
    
        const check = await userDBService.get({
            $or: [
                { tg_id: match },
                { tg_username: match }
            ]
        });

        if (check) {
            check.isAdmin = !check.iAdmin;

            await userDBService.update({ tg_id: check.tg_id }, check);

            const message = messages.userInfo(user.lang, check);

            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    adminka.hears(/driver ([0-9A-Za-z_]+)/, async (ctx) => {
        const { user } = ctx.state;

        const match = ctx.match[1];
    
        const check = await userDBService.get({
            $or: [
                { tg_id: match },
                { tg_username: match }
            ]
        });

        if (check) {
            check.status = (check.status === 'driver') ? 'free' : 'driver';

            await userDBService.update({ tg_id: check.tg_id }, check);

            const message = messages.userInfo(user.lang, check);

            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    adminka.command('addCar', async (ctx) => {
        await carDBService.create({
            tg_id: ctx.from.id,
            brand: 'Mercedes',
            model: 'W136'
        });

        await ctx.replyWithHTML('Done!');
    });

    adminka.command('addService', async (ctx) => {
        await serviceDBService.create({
            tg_id: ctx.from.id,
            title: 'Поехать в ТЦ'
        });

        await ctx.replyWithHTML('Done!');
    });

    return adminka;
}

module.exports = {
    adminPanel
}