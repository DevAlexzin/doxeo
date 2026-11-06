import db from "#db"
import ws from 'ws';
import moment from 'moment';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import gradient from 'gradient-string';
import { getCachedMeta, setCachedMeta } from '#serialize';

// ✅ Función del dibujo del ahorcado
function mostrarAhorcado(intentos) {
    const estados = [
` ____ \n |  |\n |  O\n | /|\\\n_|_`,
` ____ \n |  |\n |  O\n | /|\\\n |`,
` ____ \n |  |\n |  O\n | /|\n |`,
` ____ \n |  |\n |  O\n | /\n |`,
` ____ \n |  |\n |  O\n |\n |`,
` ____ \n |  |\n |\n |\n |`
    ];
    return estados[6 - intentos];
}

export default async (sock, msg) => {

  if (msg.fromMe && !msg.key.participant && msg.isBot) return;  
  const sender = msg.sender;
  let body = msg.body || '';

  const from = msg.key.remoteJid
  const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net' || sock.user.lid

  const chatData = await db.getChat(msg.chat)
  const settings = await db.getSettings(botJid)  

  // ============================================================
  // 🎮 MANEJADOR DEL AHORCADO (Escucha letras)
  // ============================================================
  if (msg.text && !msg.text.startsWith('.') && global.ahorcado?.[msg.sender]) {
    try {
      const sender = msg.sender;
      const juego = global.ahorcado[sender];
      const texto = msg.text.trim().toLowerCase();

      if (/^[a-zñ]$/i.test(texto)) {
        console.log(`🔍 [AHORCADO] Letra recibida: ${texto}`);

        let letra = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (juego.letrasAdivinadas.includes(letra)) {
          await sock.sendMessage(msg.chat, { text: `❌ Ya intentaste la letra "${letra}".` }, { quoted: msg });
          return;
        }

        juego.letrasAdivinadas.push(letra);

        if (!juego.palabra.includes(letra)) {
          juego.intentos--;
        }

        let palabraOculta = "";
        for (const l of juego.palabra) {
          palabraOculta += juego.letrasAdivinadas.includes(l) ? l + " " : "_ ";
        }
        palabraOculta = palabraOculta.trim();

        if (juego.intentos <= 0) {
          delete global.ahorcado[sender];
          await sock.sendMessage(msg.chat, { text: `❌ ¡Perdiste! La palabra era: *${juego.palabra}*` }, { quoted: msg });
          return;
        }

        if (!palabraOculta.includes("_")) {
          let exp = Math.floor(Math.random() * 300);
          if (juego.palabra.length >= 8) exp = Math.floor(Math.random() * 3500);
          await db.updateUser(sender, 'exp', exp).catch(() => {});
          delete global.ahorcado[sender];
          await sock.sendMessage(msg.chat, { text: `🎉 ¡Ganaste! Adivinaste la palabra *${juego.palabra}*\n\nHas ganado: *${exp} Exp*` }, { quoted: msg });
          return;
        }

        let dibujo = mostrarAhorcado(juego.intentos);
        
        await sock.sendMessage(msg.chat, {
          text: `${dibujo}\n\n${palabraOculta}\n\n💡 Letras usadas: ${juego.letrasAdivinadas.join(", ")}\n🎯 Intentos restantes: ${juego.intentos}`
        }, { quoted: msg });
        return;
      }
    } catch (e) {
      console.error("❌ [AHORCADO ERROR]:", e.message);
    }
  }
  // ============================================================
  // FIN MANEJADOR DEL AHORCADO
  // ============================================================

  // ============================================================
  // ✅ CANCELAR RULETA
  // ============================================================
  if (msg.text && msg.text.toLowerCase().trim() === 'cancelar') {
    const estado = global.ruletasActivas?.[msg.chat];
    
    if (estado && !estado.cancelado) {
      estado.cancelado = true;
      
      await sock.sendMessage(msg.chat, {
        text: `⏹️ *Ruleta cancelada*

> ✅ *${estado.usuarioTag}* se salvó de ser eliminado.

> 📊 *Uso:* No se contó en el límite diario.`
      }, { quoted: msg });
      
      delete global.ruletasActivas[msg.chat];
      return;
    }
  }
  // ============================================================
  // FIN CANCELAR RULETA
  // ============================================================

  // ============================================================
  // 🤖 MANEJADOR DE IA (Princess Bot) CON LECTURA DE MENSAJES CITADOS
  // ============================================================
  if (msg.isGroup && msg.mentionedJid?.includes(botJid)) {
    try {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let textoCitado = '';

      if (quotedMsg) {
        textoCitado = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
      }

      let textoPregunta = (msg.text || msg.body || '').replace(/@\d{8,15}/g, '').trim();

      let textoFinal = textoCitado 
        ? `Adapta este código a Baileys (Node.js) usando 'msg' y 'sock' en lugar de 'm' y 'conn':\n\n${textoCitado}` 
        : textoPregunta;

      if (textoFinal) {
        console.log(`🤖 [IA] Procesando...`);

        const instruccionesSistema = `Eres un experto en Node.js y Baileys. Devuelve SOLO el código adaptado, sin explicaciones.`;

        const consultaFinal = `${instruccionesSistema}\n\n${textoFinal}`;
        const urlAPI = `https://api.delirius.online/ia/chatgpt?q=${encodeURIComponent(consultaFinal)}`;

        console.log(`🌐 [IA] Consultando API...`);
        
        const res = await fetch(urlAPI, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const textoRespuesta = await res.text();

        if (textoRespuesta.startsWith('<!DOCTYPE') || textoRespuesta.startsWith('<html')) {
          console.log('⚠️ [IA] La API devolvió HTML (Caída)');
          return msg.reply('❌ La IA no está disponible. La API está caída.');
        }

        let json;
        try { json = JSON.parse(textoRespuesta); } catch (e) {
          console.error('⚠️ [IA] Error parseando JSON:', textoRespuesta.slice(0, 200));
          return msg.reply('❌ La IA devolvió una respuesta inválida.');
        }

        const respuestaIA = json.result || json.response || json.answer || json.data || json.message;

        if (!respuestaIA || respuestaIA.includes("No WIZ data") || respuestaIA.includes("No hay datos de WIZ")) {
          console.log('⚠️ [IA] La API se saturó (No WIZ data).');
          return msg.reply('❌ La IA está muy saturada en este momento. Intenta de nuevo en unos minutos.');
        }

        console.log(`🧠 [IA] Respuesta cruda: ${respuestaIA}`);

        const matchGuardar = respuestaIA.match(/\[GUARDAR:\s*(.+?)\]/s);
        if (matchGuardar) {
          const textoAGuardar = matchGuardar[1].trim();
          let memoria = chatData.iaMemoria || [];
          memoria.push(textoAGuardar);
          await db.updateChat(msg.chat, 'iaMemoria', memoria);
          await msg.reply(`🧠 *Princess Bot ha guardado:* "${textoAGuardar}"`);
          console.log('✅ [IA] Memoria guardada correctamente.');
          return;
        }

        const matchEnviar = respuestaIA.match(/\[ENVIAR:\s*(.+?)\s*\|\s*(.+?)\]/s);
        if (matchEnviar) {
          const numeroDestino = matchEnviar[1].replace(/\D/g, '');
          const mensajeAEnviar = matchEnviar[2].trim();
          try {
            await sock.sendMessage(numeroDestino + '@s.whatsapp.net', { text: mensajeAEnviar });
            await msg.reply(`✅ Mensaje privado enviado a ${numeroDestino}.`);
          } catch (err) { await msg.reply(`❌ No pude enviar el mensaje a ${numeroDestino}.`); }
          return;
        }

        const matchMencionar = respuestaIA.match(/\[MENCIONAR:\s*(.+?)\s*\|\s*(.+?)\]/s);
        if (matchMencionar) {
          const numeroMencion = matchMencionar[1].replace(/\D/g, '');
          const mensajeMencion = matchMencionar[2].trim();
          await sock.sendMessage(msg.chat, { text: mensajeMencion, mentions: [numeroMencion + '@s.whatsapp.net'] }, { quoted: msg });
          return;
        }

        await sock.sendMessage(msg.chat, { text: `${respuestaIA}` }, { quoted: msg });
      }
    } catch (e) {
      console.error("❌ [IA ERROR CRÍTICO]:", e.message);
      await msg.reply('❌ Ocurrió un error al conectar con la IA.');
    }
    return;
  }
  // ============================================================
  // FIN MANEJADOR DE IA
  // ============================================================

  // ============================================================
  // 🃏 MANEJADOR DE LISTA DE POKECARD
  // ============================================================
  if (msg.message?.listResponseMessage) {
    const rowId = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
    const chatId = msg.key.remoteJid;

    if (rowId && rowId.startsWith('poke_')) {
      console.log(`🔍 [POKECARD] Carta seleccionada: ${rowId}`);
      
      const index = parseInt(rowId.replace('poke_', ''));
      const cartas = global.pokecardCache?.[chatId];

      if (cartas && cartas[index]) {
        const carta = cartas[index];
        const imagenUrl = carta.images?.large || carta.images?.small;
        
        if (imagenUrl) {
          await sock.sendMessage(chatId, {
            image: { url: imagenUrl },
            caption: `🃏 *${carta.name}*\n\n> 🧬 *Tipo:* ${carta.types?.join(' / ') || 'Desconocido'}\n> ❤️ *HP:* ${carta.hp || '?'}\n> ⭐ *Rareza:* ${carta.rarity || 'Común'}\n> 📦 *Set:* ${carta.set?.name || '?'}`
          }, { quoted: msg });
        } else {
          await sock.sendMessage(chatId, { text: '❌ No se encontró la imagen de la carta.' }, { quoted: msg });
        }
      } else {
        await sock.sendMessage(chatId, { text: '❌ La sesión de búsqueda expiró. Vuelve a usar `.pokecard`. ' }, { quoted: msg });
      }
      return;
    }
  }
  // ============================================================
  // FIN MANEJADOR DE LISTA DE POKECARD
  // ============================================================

  // ============================================================
  // 🏹 MANEJADOR DE BOTÓN DE PATROCINIO
  // ============================================================
  if (msg.message?.buttonsResponseMessage) {
    const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
    const chatId = msg.key.remoteJid;

    console.log(`🔍 [PATRO DEBUG] Botón presionado. ID: "${buttonId}"`);

    if (buttonId && buttonId.startsWith('patro_entre_')) {
      console.log(`✅ [PATRO] Botón de entrega presionado: ${buttonId}`);
      
      const idPatro = buttonId.replace('patro_entre_', '');
      const chatData = await db.getChat(chatId);
      const dbKey = `patrocinios_${chatId}`;
      let patrocinios = chatData[dbKey] || [];
      
      const index = patrocinios.findIndex(p => p.id === idPatro);
      
      if (index === -1) {
        await sock.sendMessage(chatId, { text: '❌ No se encontró el patrocinio en la base de datos.' }, { quoted: msg });
        return;
      }

      if (patrocinios[index].estado === 'entregado') {
        await sock.sendMessage(chatId, { text: '⚠️ Este patrocinio ya fue marcado como entregado.' }, { quoted: msg });
        return;
      }

      patrocinios[index].estado = 'entregado';
      await db.updateChat(chatId, dbKey, patrocinios);

      const mensajeConfirmacion = `✅ *¡Patrocinio Entregado!*

> 👤 *Patrocinador:* ${patrocinios[index].nombre}
> 💰 *Valor:* ${patrocinios[index].valor}
> 📱 *Número:* ${patrocinios[index].numero}
> 🎁 *Banners:* ${patrocinios[index].banners}

> 📅 *Fecha de entrega:* ${new Date().toLocaleString('es-ES')}

> ⚠️ El estado ha sido actualizado a *Entregado*.`;

      await sock.sendMessage(chatId, { text: mensajeConfirmacion }, { quoted: msg });
      console.log(`✅ [PATRO] Patrocinio ${idPatro} marcado como entregado.`);
      return;
    }
  }
  // ============================================================
  // FIN MANEJADOR DE BOTÓN DE PATROCINIO
  // ============================================================

  // ============================================================
  // MANEJADOR DE BOTONES DE GANADORES
  // ============================================================
  if (msg.message?.buttonsResponseMessage) {
    const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
    const buttonText = msg.message.buttonsResponseMessage.selectedDisplayText;
    const chatId = msg.key.remoteJid;

    if (buttonId && buttonId.startsWith('ganadores_')) {
      const dia = buttonId.replace('ganadores_', '');
      const emojiDia = { lunes: '🍯', martes: '🍒', miercoles: '🪩', jueves: '👯‍♀️', viernes: '🏹', sabado: '🌈', extras: '✨' };
      const nombreDia = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', extras: 'Extras' };

      const temporal = global.ganadoresTemporal?.[chatId];

      if (!temporal) {
        await sock.sendMessage(chatId, { text: '❌ No se encontraron datos para anotar. Vuelve a usar el comando `.ganadores` con los datos.' }, { quoted: msg });
        return;
      }

      const tiempoTranscurrido = Date.now() - temporal.timestamp;
      if (tiempoTranscurrido > 5 * 60 * 1000) {
        delete global.ganadoresTemporal[chatId];
        await sock.sendMessage(chatId, { text: '⏳ Los datos han expirado. Vuelve a usar el comando `.ganadores` con los datos.' }, { quoted: msg });
        return;
      }

      const ahora = new Date();
      const año = ahora.getFullYear();
      const inicioAño = new Date(año, 0, 1);
      const diasTranscurridos = Math.floor((ahora - inicioAño) / 86400000);
      const semana = Math.ceil((diasTranscurridos + inicioAño.getDay() + 1) / 7);

      const chatDataGanadores = await db.getChat(chatId);
      const dbKey = `ganadores_semana_${año}_${semana}`;
      let ganadores = chatDataGanadores[dbKey] || { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], extras: [] };

      let vecesGanadas = 0;
      for (const key of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'extras']) {
        const items = ganadores[key] || [];
        vecesGanadas += items.filter(item => item.numero === temporal.numero).length;
      }

      if (vecesGanadas >= 2) {
        delete global.ganadoresTemporal[chatId];
        await sock.sendMessage(chatId, { text: `⚠️ *Este número ya ganó 2 veces esta semana.*\n\n> 📱 Número: ${temporal.numero}\n> 👤 Nombre: ${temporal.nombre}\n\n*No puede ganar más de 2 veces por semana.*` }, { quoted: msg });
        return;
      }

      ganadores[dia].push({ numero: temporal.numero, premio: temporal.premio, nombre: temporal.nombre, fecha: ahora.toISOString() });
      await db.updateChat(chatId, dbKey, ganadores);
      delete global.ganadoresTemporal[chatId];

      await sock.sendMessage(chatId, { text: `✅ *Ganador anotado correctamente*\n\n> 📱 Número: ${temporal.numero}\n> 🎁 Premio: ${temporal.premio}\n> 👤 Nombre: ${temporal.nombre}\n> 📅 Día: ${emojiDia[dia]} ${nombreDia[dia]}\n> 📊 Veces ganadas esta semana: ${vecesGanadas + 1}/2` }, { quoted: msg });
      return;
    }
  }
  // ============================================================
  // FIN MANEJADOR DE BOTONES
  // ============================================================

  const isOwner = global.owner.map(num => num + '@s.whatsapp.net').includes(sender);
  const isROwner = [botJid, ...(settings.owner ? [settings.owner] : []), ...global.owner.map(num => num + '@s.whatsapp.net')].includes(sender);

  let groupMetadata = null;
  let groupName = '';
  if (msg.isGroup) {
    groupMetadata = getCachedMeta(msg.chat);
    if (!groupMetadata) {
      groupMetadata = await sock.groupMetadata(msg.chat).catch(() => null);
      if (groupMetadata) setCachedMeta(msg.chat, groupMetadata);
    }
    groupName = groupMetadata?.subject || '';
  }
  const participants = groupMetadata?.participants || [];
  const adminSet = new Set(participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').flatMap(p => [p.id?.split('@')[0], p.lid?.split('@')[0], p.phoneNumber?.split('@')[0]].filter(Boolean)));
  const senderBase = sender.split('@')[0];
  const botBase = botJid.split('@')[0];
  const isBotAdmins = msg.isGroup ? adminSet.has(botBase) : false;
  const isAdmins = msg.isGroup ? adminSet.has(senderBase) : false;

  Promise.allSettled((global.cmdsExecute ?? []).filter(p => p.type === 'all').map(p => p.fn({ msg, sock, groupMetadata, participants, isAdmins, isBotAdmins, isOwner, __dirname: p.dirname }).catch(e => console.error(chalk.gray(`[ ✿ ] Error all-plugin ${p.key}: ${e.message}`)))));

  const tf = await db.getChatUser(msg.chat, msg.sender)
  const to = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-') 

  if (!tf) {
    await db.updateChatUser(msg.chat, msg.sender, { stats: { [to]: { msgs: 0, cmds: 0 } } });
  } else {
    if (!tf.stats) tf.stats = {}
    if (!tf.stats[to]) tf.stats[to] = { msgs: 0, cmds: 0 }
    tf.stats[to].msgs++
    await db.updateChatUser(msg.chat, msg.sender, 'stats', tf.stats)
  }

  const rawBotname = settings.namebot2 || 'Stellar';
  const tipo = settings.type || 'Sub';
  const cleanBotname = rawBotname.replace(/[^a-zA-Z0-9\s]/g, '');
  const namebot = cleanBotname || 'Stellar';
  const shortForms = [namebot.charAt(0), namebot.split(" ")[0], tipo.split(" ")[0], namebot.split(" ")[0].slice(0, 2), namebot.split(" ")[0].slice(0, 3)];
  const prefixes = shortForms.map(name => `${name}`);
  prefixes.unshift(namebot);
  let prefix;
  if (Array.isArray(settings.prefijo) || typeof settings.prefijo === 'string') {
    const prefixArray = Array.isArray(settings.prefijo) ? settings.prefijo : [settings.prefijo];
    prefix = new RegExp('^(' + prefixes.join('|') + ')?(' + prefixArray.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'i');
  } else if (settings.prefijo === 1) {
    prefix = new RegExp('^', 'i');
  } else {
    prefix = new RegExp('^(' + prefixes.join('|') + ')?', 'i');
  }
  const strRegex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  let customCmd = null;
  let pluginPrefix = prefix;
  for (const [cmdName, data] of global.comandos) {
    if (!data.customPrefix) continue;
    const cp = data.customPrefix;
    const ms = cp instanceof RegExp ? [[cp.exec(msg.text), cp]] : Array.isArray(cp) ? cp.map(p => { let r = p instanceof RegExp ? p : new RegExp(strRegex(p)); return [r.exec(msg.text), r]; }) : typeof cp === 'string' ? [[new RegExp(strRegex(cp)).exec(msg.text), new RegExp(strRegex(cp))]] : [[null, null]];
    if (ms.find(p => p[0])) { customCmd = cmdName; pluginPrefix = cp; break; }
  }
  let matchs = pluginPrefix instanceof RegExp ? [[pluginPrefix.exec(msg.text), pluginPrefix]] : Array.isArray(pluginPrefix) ? pluginPrefix.map(p => {
    let regex = p instanceof RegExp ? p : new RegExp(strRegex(p));
    return [regex.exec(msg.text), regex];
  }) : typeof pluginPrefix === 'string' ? [[new RegExp(strRegex(pluginPrefix)).exec(msg.text), new RegExp(strRegex(pluginPrefix))]] : [[null, null]];
  let match = matchs.find(p => p[0]) || null;

  for (const p of (global.cmdsExecute ?? [])) {
    if (p.type !== 'before') continue;
    try {
      if (await p.fn({ msg, sock, match, groupMetadata, participants, isAdmins, isBotAdmins, isOwner, __dirname: p.dirname })) return;
    } catch (e) {
      console.error(chalk.gray(`[ ✿ ] Error before-plugin ${p.key}: ${e.message}`));
    }
  }

  if (!match) return;
  let usedPrefix = (match[0] || [])[0] || '';
  let args = msg.text.slice(usedPrefix.length).trim().split(" ");
  let command = customCmd ?? (args.shift() || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let text = args.join(' ');
  if (!command) return;

  const pushname = msg.pushName || 'Sin nombre'

  const consolePrimary = chatData.primaryBot;

  if (msg.message || !consolePrimary || consolePrimary === botJid) {
    console.log(`
𝄢 · • —– ٠ ✤ ٠ —– • · · • —– ٠ ✤ ٠ —– • ·✧༄
❚ ▸ ${chalk.cyan('𝐁𝐎𝐓 ❱❱')} ${chalk.bgMagenta(chalk.white.italic(sock.user.name))}
❚ ▸ ${chalk.cyan('𝐇𝐎𝐑𝐀𝐑𝐈𝐎 ❱❱')} ${chalk.black.bgWhite(moment().format('DD/MM/YY HH:mm:ss'))}
❚ ${chalk.magentaBright('°o.OO.o°°o.OO.o°°o.OO.o°')}
❚ ▸ ${chalk.green('𝐔𝐒𝐔𝐀𝐑𝐈𝐎 ❱❱')} ${chalk.white(pushname)} / ${chalk.bgMagentaBright.bold(msg.isGroup ? 'Grupo' : 'Chat Private')}
❚ ▸ ${chalk.green('𝐂𝐎𝐌𝐀𝐍𝐃𝐎 ❱❱')} ${chalk.magentaBright(command ? command : 'No Command')}
❚ ${chalk.magentaBright('°o.OO.o°°o.OO.o°°o.OO.o°')}
❚ ▸ ${chalk.redBright('𝐓𝐈𝐏𝐎 ❱❱')} ${chalk.greenBright.bold('[Bot Log]')}
𝄢 · • —– ٠ ✤ ٠ —– • · · • —– ٠ ✤ ٠ —– • ·✧༄`.trim())
  }

  const hasPrefix = (settings.prefijo === 1 || settings.prefijo === true) ? true : (Array.isArray(settings.prefijo) ? settings.prefijo : typeof settings.prefijo === 'string' ? [settings.prefijo] : []).some(p => msg.text?.startsWith(p));
  const botprimaryId = chatData?.primaryBot;
  if (botprimaryId && botprimaryId !== botJid) {
    if (hasPrefix) {
      const groupJids = participants.map(p => p.id);
      const sessionDirs = ['./Sessions/Subs']
      function getAllSessionBots() {
        const bots = [];
        for (const dir of sessionDirs) {
          try {
            for (const sub of fs.readdirSync(path.resolve(dir))) {
              if (fs.existsSync(path.resolve(dir, sub, 'creds.json')))
                bots.push(sub + '@s.whatsapp.net');
            }
          } catch {}
        }
        try {
          if (fs.existsSync(path.resolve('./Sessions/Owner/creds.json'))) {
            const ownerId = global.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net';
            if (ownerId) bots.push(ownerId);
          }
        } catch {}
        return bots;
      }
      const sessionBots = getAllSessionBots();
      const primaryInGroup = groupJids.includes(botprimaryId);
      const isPrimarySelf = botprimaryId === botJid;
      const primaryInSessions = sessionBots.includes(botprimaryId);
      if (!primaryInSessions || !primaryInGroup) return;
      if ((primaryInSessions && primaryInGroup) || isPrimarySelf) return;
    }
  }

  const isVotOwn = [
    sock.user.id.split(':')[0] + '@s.whatsapp.net',
    ...global.owner.map(num => num + '@s.whatsapp.net')
  ].includes(sender)

  if (settings.self) {
    const owner = settings.owner
    if (
      sender !== owner &&
      !isVotOwn &&
      !global.mods.map(num => num + '@s.whatsapp.net').includes(sender)
    ) return
  }

  if (msg.chat && !msg.chat.endsWith('g.us')) {
    const allowedInPrivateForUsers = ['report', 'reporte', 'sug', 'suggest', 'invite', 'invitar', 'setusername', 'setpfp', 'setimage', 'setstatus', 'reload', 'setname', 'setbotname', 'setmenubanner', 'setbanner', 'setbotcurrency', 'code', 'qr', 'setbotowner', 'setlink', 'setbotlink', 'setbotprefix']
    const owners = settings.owner
    if (
      sender !== owners &&
      !global.owner.map(num => num + '@s.whatsapp.net').includes(sender) &&
      !allowedInPrivateForUsers.includes(command)
    ) return
  }

  if (chatData?.bannedGrupo && !['#bot on', '/bot on', '.bot on', '!bot on', '-bot on', '+bot on', 'bot on'].includes(body.toLowerCase()) &&
      !global.owner.map(num => num + '@s.whatsapp.net').includes(msg.sender)) return

  if (chatData.adminonly && !isAdmins) return

  if ((msg.id.startsWith("3EB0") || (msg.id.startsWith("BAE5") && msg.id.length === 16) || (msg.id.startsWith("B24E") && msg.id.length === 20))) return

  const user = await db.getChatUser(msg.chat, msg.sender)

  const today = new Date().toLocaleDateString('es-CO', { 
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-') 

  if (!user) {
    await db.updateChatUser(msg.chat, msg.sender, { stats: { [today]: { msgs: 0, cmds: 0 } } });
  } else {
    if (!user.stats) user.stats = {}
    if (!user.stats[today]) user.stats[today] = { msgs: 0, cmds: 0 }
  }

  const cmdData = global.comandos.get(command);

  // ✅ SI EL COMANDO NO EXISTE O ESTÁ MUTEADO, SE IGNORA SILENCIOSAMENTE
  if (!cmdData || user.muted === 1 || user.muted === true) {
    return; 
  }

  const comando = msg.text.slice(usedPrefix.length)

  if (cmdData.isOwner && !global.owner.map(num => num + '@s.whatsapp.net').includes(sender)) {
    return msg.reply(`ꕤ El comando *${command}* no existe.\n✎ Usa *${usedPrefix}help* para ver la lista de comandos disponibles.`)
  }

  if (cmdData.isAdmin && !isAdmins) return sock.reply(msg.chat, mess.admin, msg)
  if (cmdData.botAdmin && !isBotAdmins) return sock.reply(msg.chat, mess.botAdmin, msg)

  try {
    await sock.readMessages([msg.key])
    const user2 = await db.getUser(msg.sender)

    if (!user2) {
      await db.updateUser(msg.sender, { usedcommands: 1, exp: Math.floor(Math.random() * 100), name: msg.pushName })
    } else {
      user2.usedcommands = (user2.usedcommands || 0) + 1
      user2.exp = (user2.exp || 0) + Math.floor(Math.random() * 100)
      user2.name = msg.pushName
      await db.updateUser(msg.sender, 'exp', user2.exp)
      await db.updateUser(msg.sender, 'name', user2.name)
      await db.updateUser(msg.sender, 'usedcommands', user2.usedcommands)
    }

    settings.commandsejecut = (settings.commandsejecut || 0) + 1
    await db.updateSettings(botJid, 'commandsejecut', settings.commandsejecut)

    const userStats = await db.getChatUser(msg.chat, msg.sender)
    if (userStats && userStats.stats && userStats.stats[today]) {
      userStats.stats[today].cmds++
      await db.updateChatUser(msg.chat, msg.sender, 'stats', userStats.stats)
    }

    await cmdData.run({ msg, sock, args, command, usedPrefix, text, groupMetadata, participants, isAdmins, isBotAdmins, isOwner, __dirname: global.plugins[cmdData.pluginKey]?.dirname });
  } catch (error) {
    console.log(error)
    return msg.reply(`${error}`)
  }

};
