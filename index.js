console.log("Запуск......")
const fs = require("fs");
if (!fs.existsSync(".env")) { // Если отсутствует файл .env
    fs.appendFile(".env", "TOKEN_BOT=Токен Discord Bot\nWEBHOOK_ID=Вебхук_ID\nWEBHOOK_TOKEN=Вебхук_Токен", function (err) {
        if (err) console.error(`Произошла ошибка при создании файла .env!\nОшибка:\n` + err + "\nОстановка проекта...")
        else console.log("Файл .env создан!\nПожалуйста, отредактируйте его.\nОстановка проекта...")
        process.exit();
    })
} else {
    if (!fs.existsSync("config.json")) fs.appendFile("config.json", "{ \"config\": \"\" }", (err) => err ? console.error(err) : 0);
    if (!fs.existsSync("cache.json")) fs.appendFile("cache.json", "[]", (err) => err ? console.error(err) : 0);
};
require("dotenv").config();
const startPing = Date.now();
const config = require("./config.json");
const Discord = require("discord.js");
const strftime = require("strftime");
const readline = require('readline');
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);

function input(question) {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(question, answer => {
            rl.close();
            resolve(answer);
        });
    });
}

function filter(obj) {
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value === "" || value === null) delete obj[key];
        else if (Object.prototype.toString.call(value) === '[object Object]') filter(value);
        else if (Array.isArray(value)) value.filter(data => Object.prototype.toString.call(data) === '[object Object]').forEach(obj => filter(obj));
    });
};

let msg = require("./cache.json");
const { constants } = require("buffer");
if (!Array.isArray(msg)) msg = [];
function addMsg({ author, embeds, content, attachments, createdAt }) {
    filter(embeds);
    const objMsg = { content, embeds };
    objMsg.username = strftime(`%Y-%m-%d || ${author.username} || %H:%M:%S`, createdAt);
    objMsg.avatarURL = author.displayAvatarURL({ format: "png", dymamic: true, size: 4096 });
    objMsg.files = attachments.map(f => f.proxyURL);
    msg.push(objMsg);
    console.log(JSON.stringify(objMsg, null, 4));
    writeFile("./cache.json", JSON.stringify(msg, null, 4));
}
const hook = new Discord.WebhookClient(process.env.WEBHOOK_ID, process.env.WEBHOOK_TOKEN);
const client = new Discord.Client();

client.on("ready", () => {
    console.log(`Клиент запущен! || Ping: ${Date.now() - startPing} ms.`);
    console.log(`Текущий канал: ${!config.channel ? "Не настроен." : config.channel}`);
    console.log("Напишите .start для старта отправки сообщений.");
    console.log("Напишите .channel для изменения канала.");
    console.log("Напишите .exit для выхода.");
    console.log("Просмотреть и отредактировать сообщения можно в файле cache.json.")
    new Promise(async resolve => {
        const deletedCache = await input("Удалить прошлый список сообщений? [ Y/n ]: ");
        if (["y", "yes", "да"].some(t => deletedCache.toLowerCase().includes(t))) {
            msg = [];
            writeFile("./cache.json", "[]");
        };
        let channel = client.channels.cache.get(config.channel);
        new Promise(async resolve => {
            async function saveChannel() {
                if (channel) return resolve();
                const channel_ID = await input("Укажите ID канала: ");
                const channel2 = client.channels.cache.get(channel_ID);
                if (!channel2) {
                    console.log(">>> Канал не найден!!!");
                    saveChannel();
                } else {
                    channel = channel2;
                    console.log(`>>> Выбран канал #${channel2.name} ( ${channel2.id} )`);
                    config.channel = channel2.id
                    await writeFile("./config.json", JSON.stringify(config, null, 4));
                    resolve()
                }
            };
            saveChannel()
        }).then(() => write())
        async function write(id) {
            if (!id) id = await input(`Укажите ID сообщения №${msg.length+1}: `);
            if (id.toLowerCase() === ".start") {
                if (msg.length === 0) {
                    console.log(">>> А сообщений то нема!!!");
                    write();
                    return;
                };
                const bool = await input(`Будет отправлено ${msg.length} сообщений. Продолжить? [ Y/n ] `);
                if (["y", "yes", "да"].some(t => bool.toLowerCase().includes(t))) {
                    let i = 0;
                    async function send() {
                        if (msg.length === 0) {
                            console.log(">>> Передача файлов завершена, всего хорошего.");
                            process.exit();
                        };
                        i++
                        console.log(`>>> Отправляю ${i} сообщение...`);
                        console.log(msg[0]);
                        await hook.send(msg[0]);
                        msg.shift();
                        send();
                    }
                    return send()
                } else write()
            } else if (id.toLowerCase() === ".channel") {
                const channel_ID = await input("Укажите ID канала: ");
                const channel2 = client.channels.cache.get(channel_ID);
                if (channel2) {
                    channel = channel2;
                    console.log(`>>> Установлен канал #${channel.name} ( ${channel.id} )`);
                    config.channel = channel.id;
                    writeFile("./config.json", JSON.stringify(config, null, 4));
                    write();
                } else {
                    console.log(">>> Канал не найден!!!");
                    write(".channel");;
                };
            } else if (id.toLowerCase() === ".exit") process.exit();
            else {
                channel.messages.fetch(id)
                    .then(m => { addMsg(m); write() })
                    .catch(err => { console.error(">>> Сообщение не найдено!!! Ошибка:\n" + err.stack); write() });
            }
        };
    })
});
client.login(process.env.TOKEN_BOT);