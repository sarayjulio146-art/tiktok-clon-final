import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, query, where, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "./config";
import { VideoTarjeta } from "./videos";

// ---------- BUSCAR USUARIOS ----------
export function Buscar(props) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [busco, setBusco] = useState(false);

  function buscar() {
    if (texto == "") {
      return;
    }
    // Traemos todos los usuarios y nos quedamos con los que coinciden
    getDocs(collection(db, "usuarios")).then(function(resultado) {
      const lista = [];
      resultado.forEach(function(documento) {
        const persona = documento.data();
        persona.id = documento.id;
        // Pasamos todo a minusculas para que no importe como se escriba
        if (persona.nombre.toLowerCase().includes(texto.toLowerCase())) {
          lista.push(persona);
        }
      });
      setResultados(lista);
      setBusco(true);
    });
  }

  return (
    <div>
      <h3>Buscar usuarios</h3>
      <input
        placeholder="Nombre de usuario"
        value={texto}
        onChange={function(evento) { setTexto(evento.target.value); }}
      />
      <button onClick={buscar}>Buscar</button>

      {busco && resultados.length == 0 && <p>No se encontraron usuarios</p>}
      {resultados.map(function(persona) {
        return (
          <p key={persona.id}>
            <b>{persona.nombre}</b>
            <button onClick={function() { props.alAbrirPerfil(persona.id); }}>Ver perfil</button>
          </p>
        );
      })}
    </div>
  );
}

// ---------- PERFIL DE UN USUARIO ----------
export function Perfil(props) {
  const usuario = props.usuario;     // la persona que inicio sesion
  const perfilId = props.perfilId;   // el perfil que estamos viendo

  const [persona, setPersona] = useState(null);
  const [seguidores, setSeguidores] = useState(0);
  const [seguidos, setSeguidos] = useState(0);
  const [yoSigo, setYoSigo] = useState(false);
  const [videos, setVideos] = useState([]);
  const [editando, setEditando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [descripcionNueva, setDescripcionNueva] = useState("");

  // Cada vez que cambia el perfil que vemos, traemos sus datos
  useEffect(function() {
    // 1. Datos de la persona
    getDoc(doc(db, "usuarios", perfilId)).then(function(documento) {
      if (documento.exists()) {
        const datos = documento.data();
        datos.id = perfilId;
        setPersona(datos);
        setNombreNuevo(datos.nombre);
        setDescripcionNueva(datos.descripcion);
      }
    });

    // 2. Cuantos la siguen (y si yo la sigo)
    const consultaSeguidores = query(collection(db, "seguidores"), where("seguidoId", "==", perfilId));
    getDocs(consultaSeguidores).then(function(resultado) {
      let sigo = false;
      resultado.forEach(function(documento) {
        if (documento.data().seguidorId == usuario.id) {
          sigo = true;
        }
      });
      setSeguidores(resultado.size);
      setYoSigo(sigo);
    });

    // 3. A cuantos sigue
    const consultaSeguidos = query(collection(db, "seguidores"), where("seguidorId", "==", perfilId));
    getDocs(consultaSeguidos).then(function(resultado) {
      setSeguidos(resultado.size);
    });

    // 4. Sus videos
    const consultaVideos = query(collection(db, "videos"), where("usuarioId", "==", perfilId));
    getDocs(consultaVideos).then(function(resultado) {
      const lista = [];
      resultado.forEach(function(documento) {
        const video = documento.data();
        video.id = documento.id;
        lista.push(video);
      });
      // Los mas nuevos primero
      lista.sort(function(a, b) {
        const fechaA = a.fecha ? a.fecha.seconds : 0;
        const fechaB = b.fecha ? b.fecha.seconds : 0;
        return fechaB - fechaA;
      });
      setVideos(lista);
    });
  }, [perfilId]);

  // Seguir o dejar de seguir
  function alternarSeguir() {
    // El id junta quien sigue y a quien sigue, asi no se puede repetir
    const idSeguir = usuario.id + "_" + perfilId;

    if (yoSigo) {
      deleteDoc(doc(db, "seguidores", idSeguir)).then(function() {
        setYoSigo(false);
        setSeguidores(seguidores - 1);
      });
    } else {
      setDoc(doc(db, "seguidores", idSeguir), { seguidorId: usuario.id, seguidoId: perfilId }).then(function() {
        setYoSigo(true);
        setSeguidores(seguidores + 1);
      });
    }
  }

  // Guardar los cambios del perfil propio
  function guardarPerfil() {
    if (nombreNuevo == "") {
      return;
    }
    updateDoc(doc(db, "usuarios", usuario.id), {
      nombre: nombreNuevo,
      descripcion: descripcionNueva
    }).then(function() {
      const datos = {
        id: usuario.id,
        nombre: nombreNuevo,
        correo: persona.correo,
        descripcion: descripcionNueva,
        foto: persona.foto
      };
      setPersona(datos);
      setEditando(false);
      // Le avisamos a App para que actualice el nombre del saludo
      props.alActualizar(datos);
    });
  }

  if (persona == null) {
    return <p>Cargando perfil...</p>;
  }

  const esMiPerfil = perfilId == usuario.id;

  return (
    <div>
      <h3>Perfil de {persona.nombre}</h3>
      <p>{persona.descripcion}</p>
      <p>
        <b>{seguidores}</b> seguidores | <b>{seguidos}</b> seguidos
      </p>

      {/* Si es mi perfil puedo editarlo, si no, puedo seguir */}
      {esMiPerfil && !editando &&
        <button onClick={function() { setEditando(true); }}>Editar perfil</button>
      }
      {!esMiPerfil &&
        <button onClick={alternarSeguir}>{yoSigo ? "Dejar de seguir" : "Seguir"}</button>
      }

      {editando &&
        <div>
          <input
            placeholder="Nombre"
            value={nombreNuevo}
            onChange={function(evento) { setNombreNuevo(evento.target.value); }}
          />
          <input
            placeholder="Descripción"
            value={descripcionNueva}
            onChange={function(evento) { setDescripcionNueva(evento.target.value); }}
          />
          <button onClick={guardarPerfil}>Guardar</button>
          <button onClick={function() { setEditando(false); }}>Cancelar</button>
        </div>
      }

      <h4>Videos ({videos.length})</h4>
      {videos.length == 0 && <p>Todavía no ha publicado videos</p>}
      {videos.map(function(video) {
        return <VideoTarjeta key={video.id} video={video} usuario={usuario} />;
      })}
    </div>
  );
}