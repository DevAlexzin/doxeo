import db from "#db"
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function reloadCommands(dir) {
  const commandsMap = new Map()

  async function readCommands(folder) {
    const files = fs.readdirSync(folder)
    for (const file of files) {
      const fullPath = path.join(folder, file)
      
      if (fs.lstatSync(fullPath).isDirectory()) {
        // Si es una carpeta, entramos a leerla
        await readCommands(fullPath)
      } else if (file.endsWith('.js')) {
        // ✅ IGNORAMOS ARCHIVOS QUE NO SON COMANDOS
        if (file.includes('Checker') || file.includes('checker') || file === 'db.js') {
          continue;
        }

        try {
          const { default: cmd } = await import(fullPath + '?update=' + Date.now())
          
          // ✅ Validamos que sea un comando válido (que tenga 'command' y 'run')
          if (cmd?.command && cmd?.run) {
            cmd.command.forEach((c) => {
              commandsMap.set(c.toLowerCase(), cmd)
            })
          }
        } catch (err) {
          console.error(`❌ Error recargando comando ${file}:`, err.message)
        }
      }
    }
  }

  // ✅ Leemos la carpeta 'cmds', NO la raíz
  await readCommands(dir)
  global.comandos = commandsMap
  console.log(`✅ [FIX] Comandos recargados correctamente. Total: ${commandsMap.size}`);
}

export default {
  command: ['fix', 'update'],
  category: 'owner',
  isOwner: true,
  run: async ({ msg, sock }) => {
    // Ejecutamos git pull
    exec('git pull', async (error, stdout, stderr) => {
      
      // ✅ Recargamos los comandos apuntando SOLO a la carpeta 'cmds'
      // __dirname es cmds/owner, entonces '..' sube a cmds
      await reloadCommands(path.join(__dirname, '..'))

      let mensajeRespuesta = ''
      if (stdout.includes('Already up to date.')) {
        mensajeRespuesta = 'ꕥ *Estado:* Todo está actualizado'
      } else {
        mensajeRespuesta = `*Actualización completada*\n\n${stdout}`
      }

      await sock.sendMessage(msg.chat, { text: mensajeRespuesta }, { quoted: msg })
    })
  }
}
