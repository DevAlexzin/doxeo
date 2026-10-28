import db from "#db"
import fetch from "node-fetch"

export default {
  command: ["dni", "reniec"],
  category: "tools",
  botAdmin: false,
  run: async ({ msg, sock, args }) => {
    try {
      const dni = args[0];
      if (!dni || !/^\d{8}$/.test(dni)) {
        return msg.reply("❌ Debes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* `.dni 27427864`");
      }

      // ⚠️ PEGA AQUÍ TU TOKEN DE JSON.PE
      const token = "d3b302afd932fd3833c16d2a5f4a31f891e76f9eb922001f97251962d093"; 

      console.log(`🔍 [RENIEC] Consultando DNI: ${dni} en JSON.pe`);

      // ✅ Petición POST a la nueva API
      const res = await fetch("https://api.json.pe/api/dni", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dni: dni }),
      });

      if (!res.ok) {
        return msg.reply(`❌ Error en la API (Código: ${res.status}).\n\n> Verifica que tu token sea válido.`);
      }

      const json = await res.json();
      
      // ✅ Validamos que la respuesta sea exitosa y tenga los datos
      if (!json.success || !json.data) {
        return msg.reply("❌ No se encontró información para ese DNI.");
      }

      const data = json.data;

      // ✅ Armamos el mensaje SOLO con lo que devuelve esta API
      const mensaje = `🪪 *CONSULTA RENIEC*

> 👤 *Nombres:* ${data.nombres || 'No disponible'}
> 👤 *Apellido Paterno:* ${data.apellidoPaterno || 'No disponible'}
> 👤 *Apellido Materno:* ${data.apellidoMaterno || 'No disponible'}
> 👤 *Nombre Completo:* ${data.nombreCompleto || 'No disponible'}
> 🆔 *DNI:* ${dni}

> 🔒 _Consulta realizada de forma segura_`;

      await sock.sendMessage(msg.chat, { text: mensaje }, { quoted: msg });

    } catch (e) {
      console.error("❌ [DNI ERROR]:", e.message);
      msg.reply("❌ Ocurrió un error al conectar con la API.");
    }
  }
};
