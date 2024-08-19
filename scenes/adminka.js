const fs = require('fs');

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

        ctx.scene.state.key = null;

        const message = messages.adminPanel(user.lang);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    adminka.action('services', async (ctx) => {
        await ctx.deleteMessage();
        await ctx.scene.enter('service');
    });

    adminka.action(['cars', 'drivers'], async (ctx) => {
        const { user } = ctx.state;
        const { message_id } = ctx.update.callback_query.message;

        ctx.scene.state.key = ctx.callbackQuery.data;

        const message = messages.simple(user.lang, 'enterUsername_message', message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    adminka.action('tariffs', async (ctx) => {
        await ctx.deleteMessage();
        await ctx.scene.enter('edit_tariff');
    });

    adminka.action('back', async (ctx) => {
        await ctx.deleteMessage();
        await ctx.scene.reenter();
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

    adminka.on('text', async (ctx) => {
        const { key } = ctx.scene.state;
        const { text } = ctx.message;

        if (key === 'cars' || key === 'drivers') {
            const check = await userDBService.get({
                $or: [
                    { tg_id: text },
                    { tg_username: text}
                ]
            });

            if (check) {
                const sceneName = (key === 'cars') ?
                    'car' : 'edit_driver';

                await ctx.scene.enter(sceneName, {
                    user: check
                });
            }
        }
    });

    return adminka;
}

function addService() {
    const service = new Scene('service');

    service.use(middlewares.start);

    service.enter(async (ctx) => {
        const { user } = ctx.state;

        ctx.scene.state.type = null;
        ctx.scene.state.key = null;
        ctx.scene.state.data = {
            step: 0,
            tg_id: ctx.from.id
        };
        ctx.scene.state.services = await serviceDBService.getAll({});

        const message = messages.services(user.lang, ctx.scene.state.services, 0, true);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    service.action('confirm', async (ctx) => {
        const {
            key,
            data
        } = ctx.scene.state;

        let answer = null;

        if (key === 'srv') {
            answer = ctx.i18n.t('serviceIsAdded_message');

            await serviceDBService.create(data);
        }

        if (answer) {
            await ctx.answerCbQuery(answer, true);
        }

        await ctx.deleteMessage();
        await ctx.scene.reenter();
    });

    service.action(/add-(srv)/, async (ctx) => {
        const { user } = ctx.state;
        const { data } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];

        let message = null;

        ctx.scene.state.type = 'add';
        ctx.scene.state.key = key;

        if (key === 'srv') {
            message = messages.addService(user.lang, data, message_id);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    service.action(/edit-(srv)-([a-z0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];
        const _id = ctx.match[2];

        let message = null;

        ctx.scene.state.type = 'edit';
        ctx.scene.state.key = 'srv';

        if (key === 'srv') {
            ctx.scene.state.data = await serviceDBService.get({ _id });

            message = messages.editService(user.lang, ctx.scene.state.data, message_id);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    service.action(/([a-z]+)-([a-z_]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { data } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;
        const { match } = ctx;

        let message = null;

        ctx.scene.state.key = match[1] + '-' + match[2];

        if (match[1] === 'srv') {
            if (match[2] === 'delete') {
                await serviceDBService.delete({ _id: data._id });

                await ctx.deleteMessage();

                return await ctx.scene.reenter();
            } else if (match[2] === 'title') {
                data.step = 0;
            } else {
                data.step = 1;
            }

            message = messages.addService(user.lang, data, message_id);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    service.action(/next-([a-z]+)-([0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { services } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];
        const page = Number(ctx.match[2]);

        let message = null;

        if (key === 'srv') {
            message = messages.services(user.lang, services, page, true, message_id);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    service.action('back', async (ctx) => {
        const { user } = ctx.state;
        const {
            type,
            key,
            data,
            services
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        console.log(type, key)

        if (type) {
            let message = null;

            if (type === 'add') {
                if (data.step > 0) {
                    data.step--;
                }

                if (data.step === 0) {
                    ctx.scene.state.type = null;
                    ctx.scene.state.key = null;
                }

                if (key === 'srv') {
                    message = (data.step === 0) ?
                        messages.services(user.lang, services, 0, true, message_id) :
                        messages.addService(user.lang, data, message_id);
                }
            } else if (type === 'edit') {
                if (key.includes('srv')) {
                    if (key.includes('-')) {
                        message = messages.editService(user.lang, data, message_id);
                    } else {
                        ctx.scene.state.type = null;
                        ctx.scene.state.key = null;

                        message = messages.services(user.lang, services, 0, true, message_id);
                    }
                }
            }

            if (message) {
                sender.enqueue({
                    chat_id: ctx.from.id,
                    message
                });
            }
        } else {
            await ctx.deleteMessage();
            await ctx.scene.enter('adminka');
        }
    });

    service.on('text', async (ctx) => {
        const { user } = ctx.state;
        const {
            key,
            data
        } = ctx.scene.state;
        const { text } = ctx.message;
        const text_num = Number(text);

        if (key) {
            let isCorrect = false,
                message = null;

            if (key.includes('srv')) {
                if (data.step === 0) {
                    isCorrect = true;
                    data.title = text;
                } else if (data.step === 1 && text_num && text_num > 0) {
                    isCorrect = true;
                    data.limits = text_num;
                }
            }

            if (isCorrect) {
                if (key.includes('srv')) {
                    if (data._id) {
                        const temp = await serviceDBService.update({ _id: data._id }, data, 'after');

                        ctx.scene.state.key = 'srv';

                        message = messages.editService(user.lang, temp);
                    } else {
                        ctx.scene.state.data.step++;

                        message = messages.addService(user.lang, data);
                    }
                }
            }

            if (message) {
                sender.enqueue({
                    chat_id: ctx.from.id,
                    message
                });
            }
        }
    });

    return service;
}

function editTariff() {
    const edit_tariff = new Scene('edit_tariff');

    edit_tariff.use(middlewares.start);

    edit_tariff.enter(async (ctx) => {
        const { user } = ctx.state;

        const config = JSON.parse(fs.readFileSync('./config.json'));

        ctx.scene.state.config = config;
        ctx.scene.state.data = null;

        const message = messages.tariffs(user.lang, config['TARIFFS']);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_tariff.action(/tariff-([0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { config } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const id = ctx.match[1];

        ctx.scene.state.data = config['TARIFFS'].find(el => el.id == id);

        const message = messages.editTariff(user.lang, ctx.scene.state.data, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_tariff.action(/edit-([a-z]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];

        ctx.scene.state.key = key;

        const message = messages.simple(user.lang, `enter_${key}_message`, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_tariff.action('back', async (ctx) => {
        const { user } = ctx.state;
        const {
            key,
            data
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        let message = null;

        if (key) {
            ctx.scene.state.key = null;

            message = messages.editTariff(user.lang, data, message_id);
        } else if (data) {
            await ctx.deleteMessage();
            return await ctx.scene.reenter();
        } else {
            await ctx.deleteMessage();
            return await ctx.scene.enter('adminka');
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    edit_tariff.on('text', async (ctx) => {
        const { user } = ctx.state;
        const {
            key,
            data,
            config
        } = ctx.scene.state;
        const { text } = ctx.message;
        const text_num = Number(text);

        let message = null;

        if (key) {
            if (key === 'title') {
                data[key] = text;
            } else if (text_num && text_num >= 0) {
                data[key] = text_num;
            }

            ctx.scene.state.key = null;

            config['TARIFFS'].forEach((el, index) => {
                if (el.id == data.id) {
                    config['TARIFFS'][index] = data;
                }
            });

            fs.writeFileSync('./config.json', JSON.stringify(config));

            message = messages.editTariff(user.lang, data);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    return edit_tariff;
}

function editDriver() {
    const edit_driver = new Scene('edit_driver');

    edit_driver.use(middlewares.start);

    edit_driver.enter(async (ctx) => {
        const { user } = ctx.state;

        ctx.scene.state.key = null;
        ctx.scene.state.data = ctx.scene.state.user

        const message = messages.editDriver(user.lang, ctx.scene.state.data);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_driver.action(/edit-([a-z_]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];

        ctx.scene.state.key = key;

        const message = messages.simple(user.lang, `enter_${key}_message`, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_driver.action('back', async (ctx) => {
        const { key } = ctx.scene.state;

        await ctx.deleteMessage();

        if (key) {
            await ctx.scene.reenter();
        } else {
            await ctx.scene.enter('adminka');
        }
    });

    edit_driver.on('text', async (ctx) => {
        const { user } = ctx.state;
        const {
            key,
            data
        } = ctx.scene.state;
        const { text } = ctx.message;
        const text_num = Number(text);

        let message = null;

        if (key) {
            if (key.includes('time') && text_num) {
                data[key] = text_num;
            } else {
                data[key] = text;
            }

            await userDBService.update({ tg_id: data.tg_id }, data);

            ctx.scene.state.key = null;

            message = messages.editDriver(user.lang, data);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    return edit_driver;
}

module.exports = {
    adminPanel,
    addService,
    editTariff,
    editDriver
}