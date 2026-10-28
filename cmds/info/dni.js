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
        return msg.reply("❌ Debes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* `.dni 46807126`");
      }

      // ⚠️ PEGA AQUÍ TU NUEVO TOKEN REGENERADO
      const token = "TU_NUEVO_TOKEN_AQUI"; 
      
      // ✅ URL EXACTA DE LA DOCUMENTACIÓN
      const apiUrl = `https://api-codart.cgrt.org/api/v1/consultas/reniec/dni/${dni}`; 

      console.log(`🔍 [RENIEC] Consultando DNI: ${dni}`);

      const res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        return msg.reply(`❌ Error en la API (Código: ${res.status}).\n\n> Verifica que tu token sea válido.`);
      }

      const json = await res.json();
      
      // ✅ La API devuelve los datos dentro de "result"
      if (!json.success || !json.result) {
        return msg.reply("❌ No se encontró información para ese DNI.");
      }

      const data = json.result;

      // ✅ Armar el mensaje con los campos que devuelve la API
      const mensaje = `🪪 *CONSULTA RENIEC*

> 👤 *Nombre Completo:* ${data.full_name || 'No disponible'}
> 🆔 *DNI:* ${data.document_number || dni}
> 🎂 *Fecha de Nacimiento:* ${data.birth_date || 'No disponible'}
> 🚻 *Género:* ${data.gender === 'F' ? 'Femenino' : data.gender === 'M' ? 'Masculino' : 'No disponible'}
> 🌎 *Nacionalidad:* ${data.nationality || 'No disponible'}

> 🔒 _Consulta realizada de forma segura_`;

      await sock.sendMessage(msg.chat, { text: mensaje }, { quoted: msg });

    } catch (e) {
      console.error("❌ [DNI ERROR]:", e.message);
      msg.reply("❌ Ocurrió un error al conectar con la API.");
    }
  }
};
