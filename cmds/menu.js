import db from "#db"
import fs from 'fs'
import path from 'path'

const menuImagePath = path.join(process.cwd(), 'menu.jpeg')

export default {
  command: ['menu', 'help', 'allmenu'],
  category: 'info',
  run: async ({ msg, sock }) => {
    try {
      const botId = sock?.user?.id?.split(':')[0] + '@s.whatsapp.net' || ''
      const botSettings = await db.getSettings(botId)
      const botname = botSettings.namebot || 'Princess Bot'
      const link = botSettings.link || 'https://wa.me/+5491172630652'

      // ✅ Saludo automático
      const hora = new Date().getHours()
      let saludo = hora >= 6 && hora < 12 ? 'Buenos días ☀️' 
                  : hora >= 12 && hora < 20 ? 'Buenas tardes 🌤️' 
                  : 'Buenas noches 🌙'

      // ✅ DISEÑO PROPIO CON SOLO EL COMANDO DNI
      const menu = `╔══════════════════╗
   ✦ ${botname.toUpperCase()} ✦
╚══════════════════╝

> 👋 *${saludo}*, @${msg.sender.split('@')[0]}

┌───────────────────┐
│ 📌 *COMANDO* │
└───────────────────┘

> 🪪 **.dni**
> ╰▸ Consulta información de un DNI.

┌───────────────────┐
│ 🔗 *ENLACES* │
└───────────────────┘

> 📞 *Link:* ${link}
> 👨‍💻 *Developer:* Oculto por privacidad

╰───────────────────╯`;

      const contextBase = {
        mentionedJid: [msg.sender],
        isForwarded: false,
      };

      if (fs.existsSync(menuImagePath)) {
        return sock.sendMessage(msg.chat, {
          image: fs.readFileSync(menuImagePath),
          caption: menu.trim(),
          contextInfo: contextBase
        }, { quoted: msg })
      } else {
        return sock.sendMessage(msg.chat, {
          text: menu.trim(),
          contextInfo: contextBase
        }, { quoted: msg })
      }

    } catch (e) {
      console.error('❌ [MENU ERROR]:', e.message)
      msg.reply('❌ Ocurrió un error al cargar el menú.')
    }
  }
}
