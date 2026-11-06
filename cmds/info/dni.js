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

      // ⚠️ PEGA AQUÍ TU TOKEN DE CODART
      const token = "3PTHRsi2QxhKDHrcwu2izm1p0iLRIUrXk2uR5SknsmneA31K8W3LHmKThsba"; 

      console.log(`🔍 [DNI] Consultando DNI: ${dni} en Codart`);

      const apiUrl = `https://api-codart.cgrt.org/api/v1/consultas/fd/dni/${dni}`;

      const res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`, 
          "Content-Type": "application/json",
        },
      });

      console.log(`📡 [DNI] Estado HTTP: ${res.status}`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ [DNI] Error HTTP: ${res.status} - ${errorText}`);
        return msg.reply(`❌ Error en la API (Código: ${res.status}).\n\n> Verifica tu token o si te quedan créditos.`);
      }

      const json = await res.json();
      
      console.log("========================================");
      console.log("RESPUESTA DE CODART (DNI):");
      // No imprimimos todo el JSON porque el Base64 de la foto es gigante y llenaría la consola
      console.log({ success: json.success, message: json.message }); 
      console.log("========================================");

      // ✅ Validamos la respuesta
      if (!json.success || !json.data) {
        return msg.reply("❌ No se encontró información para ese DNI.");
      }

      const data = json.data;

      // ✅ Armamos el texto de la consulta
      const caption = `🪪 *CONSULTA RENIEC (CODART)*

> 👤 *Nombres:* ${data.nombres}
> 👤 *Apellidos:* ${data.apellidos}
> 🆔 *DNI:* ${data.dni.completo}
> 🚻 *Género:* ${data.genero}

📅 *Nacimiento:*
> 🎂 *Fecha:* ${data.nacimiento.fecha} (${data.nacimiento.edad})
> 🌎 *Lugar:* ${data.nacimiento.distrito}, ${data.nacimiento.provincia}, ${data.nacimiento.departamento}

📋 *Información General:*
> 🎓 *Educación:* ${data.informacion_general.nivel_educativo}
> 💍 *Estado Civil:* ${data.informacion_general.estado_civil}
> 📏 *Estatura:* ${data.informacion_general.estatura}
> 🩸 *Donante:* ${data.informacion_general.donante_organos}

📍 *Domicilio:*
> 🏠 ${data.domicilio.direccion}
> 🌆 ${data.domicilio.distrito}, ${data.domicilio.provincia}, ${data.domicilio.departamento}

> 🔒 _Consulta realizada de forma segura_`;

      // ✅ Verificamos si la API devolvió una imagen
      let imageBuffer = null;
      
      if (data.images && data.images.length > 0 && data.images[0].data_uri) {
        console.log("📸 [DNI] La API devolvió una imagen. Convirtiendo Base64...");
        
        // Separamos el encabezado "data:image/jpeg;base64," del texto Base64
        const base64Data = data.images[0].data_uri.split(',')[1];
        
        if (base64Data) {
          imageBuffer = Buffer.from(base64Data, 'base64');
          console.log(`✅ [DNI] Imagen convertida (${imageBuffer.length} bytes).`);
        }
      }

      // ✅ Enviamos la imagen con el texto, o solo el texto si no hay imagen
      if (imageBuffer) {
        await sock.sendMessage(msg.chat, {
          image: imageBuffer,
          caption: caption
        }, { quoted: msg });
        console.log("✅ [DNI] Imagen y datos enviados.");
      } else {
        await sock.sendMessage(msg.chat, {
          text: caption
        }, { quoted: msg });
        console.log("✅ [DNI] Solo texto enviado (no había imagen).");
      }

    } catch (e) {
      console.error("❌ [DNI ERROR CRÍTICO]:", e.message);
      msg.reply("❌ Ocurrió un error al conectar con la API.");
    }
  }
};
