import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, where, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

// Datos de tu cuenta de Cloudinary
const NOMBRE_NUBE = "awhpdgct";
const PRESET = "tiktok-clon";

// ---------- FORMULARIO PARA SUBIR UN VIDEO ----------
export function SubirVideo(props) {
  const [archivo, setArchivo] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  function subir() {
    if (archivo == null) {
      setMensaje("Primero elige un video");
      return;
    }
    setSubiendo(true);
    setMensaje("Subiendo video...");

    // Preparamos el archivo para mandarlo a Cloudinary
    const formulario = new FormData();
    formulario.append("file", archivo);
    formulario.append("upload_preset", PRESET);

    // 1. Subimos el video a Cloudinary
    fetch("https://api.cloudinary.com/v1_1/" + NOMBRE_NUBE + "/video/upload", {
      method: "POST",
      body: formulario
    })
      .then(function(respuesta) {
        return respuesta.json();
      })
      .then(function(datos) {
        // Si Cloudinary no devolvio el enlace, hubo un error
        if (!datos.secure_url) {
          throw new Error(datos.error ? datos.error.message : "No se pudo subir");
        }
        // 2. Guardamos el enlace del video en la coleccion "videos" de Firestore
        return addDoc(collection(db, "videos"), {
          usuarioId: props.usuario.id,
          usuarioNombre: props.usuario.nombre,
          url: datos.secure_url,
          descripcion: descripcion,
          fecha: serverTimestamp()
        });
      })
      .then(function() {
        setMensaje("Video publicado");
        setArchivo(null);
        setDescripcion("");
        setSubiendo(false);
        // Le avisamos a App para que recargue el feed
        props.alPublicar();
      })
      .catch(function(error) {
        setMensaje("Error: " + error.message);
        setSubiendo(false);
      });
  }

  return (
    <div>
      <h3>Subir video</h3>
      <input
        type="file"
        accept="video/*"
        onChange={function(evento) { setArchivo(evento.target.files[0]); }}
      />
      <input
        placeholder="Descripción"
        value={descripcion}
        onChange={function(evento) { setDescripcion(evento.target.value); }}
      />
      <button onClick={subir} disabled={subiendo}>Publicar</button>
      <p>{mensaje}</p>
    </div>
  );
}

// ---------- UN VIDEO CON SUS ME GUSTA Y COMENTARIOS ----------
export function VideoTarjeta(props) {
  const video = props.video;
  const usuario = props.usuario;

  const [cantidadLikes, setCantidadLikes] = useState(0);
  const [yaDiLike, setYaDiLike] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [textoComentario, setTextoComentario] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Al aparecer el video, traemos sus likes y sus comentarios
  useEffect(function() {
    // Likes de este video
    const consultaLikes = query(collection(db, "likes"), where("videoId", "==", video.id));
    getDocs(consultaLikes).then(function(resultado) {
      let mio = false;
      resultado.forEach(function(documento) {
        if (documento.data().usuarioId == usuario.id) {
          mio = true;
        }
      });
      setCantidadLikes(resultado.size);
      setYaDiLike(mio);
    });

    // Comentarios de este video
    const consultaComentarios = query(collection(db, "comentarios"), where("videoId", "==", video.id));
    getDocs(consultaComentarios).then(function(resultado) {
      const lista = [];
      resultado.forEach(function(documento) {
        const comentario = documento.data();
        comentario.id = documento.id;
        lista.push(comentario);
      });
      // Ordenamos del mas viejo al mas nuevo
      lista.sort(function(a, b) {
        const fechaA = a.fecha ? a.fecha.seconds : 0;
        const fechaB = b.fecha ? b.fecha.seconds : 0;
        return fechaA - fechaB;
      });
      setComentarios(lista);
    });
  }, [video.id]);

  // Si el video esta pausado lo reproduce, y si no, lo pausa
  function alternar(evento) {
    const elemento = evento.target;
    if (elemento.paused) {
      elemento.play();
    } else {
      elemento.pause();
    }
  }

  // Dar o quitar me gusta
  function alternarLike() {
    // El id del like junta el video y el usuario, asi no se puede repetir
    const idLike = video.id + "_" + usuario.id;

    if (yaDiLike) {
      deleteDoc(doc(db, "likes", idLike)).then(function() {
        setYaDiLike(false);
        setCantidadLikes(cantidadLikes - 1);
      });
    } else {
      setDoc(doc(db, "likes", idLike), { videoId: video.id, usuarioId: usuario.id }).then(function() {
        setYaDiLike(true);
        setCantidadLikes(cantidadLikes + 1);
      });
    }
  }

  // Publicar un comentario nuevo
  function comentar() {
    if (textoComentario == "") {
      return;
    }
    const texto = textoComentario;
    addDoc(collection(db, "comentarios"), {
      videoId: video.id,
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      texto: texto,
      fecha: serverTimestamp()
    }).then(function(referencia) {
      // Lo agregamos a la lista que se ve en pantalla
      const nuevo = {
        id: referencia.id,
        videoId: video.id,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        texto: texto,
        fecha: null
      };
      setComentarios(comentarios.concat([nuevo]));
      setTextoComentario("");
    });
  }

  // Borrar un comentario (solo se muestra el boton en los propios)
  function borrarComentario(comentario) {
    deleteDoc(doc(db, "comentarios", comentario.id)).then(function() {
      const restantes = comentarios.filter(function(c) {
        return c.id != comentario.id;
      });
      setComentarios(restantes);
    });
  }

  // Compartir: copia el enlace del video
  function compartir() {
    navigator.clipboard.writeText(video.url).then(function() {
      setMensaje("Enlace copiado");
    });
  }

  return (
    <div>
      <p><b>{video.usuarioNombre}</b></p>
      <video src={video.url} width="300" loop playsInline preload="metadata" onClick={alternar}></video>
      <p>{video.descripcion}</p>
      <small>Toca el video para reproducir o pausar</small>

      <div>
        <button onClick={alternarLike}>
          {yaDiLike ? "Quitar me gusta" : "Me gusta"}
        </button>
        <span> {cantidadLikes} me gusta </span>
        <button onClick={compartir}>Compartir</button>
        <span> {mensaje}</span>
      </div>

      <div>
        <b>Comentarios ({comentarios.length})</b>
        {comentarios.map(function(comentario) {
          return (
            <p key={comentario.id}>
              <b>{comentario.usuarioNombre}: </b>{comentario.texto}
              {comentario.usuarioId == usuario.id &&
                <button onClick={function() { borrarComentario(comentario); }}>Borrar</button>
              }
            </p>
          );
        })}
        <input
          placeholder="Escribe un comentario"
          value={textoComentario}
          onChange={function(evento) { setTextoComentario(evento.target.value); }}
        />
        <button onClick={comentar}>Comentar</button>
      </div>
      <hr />
    </div>
  );
}

// ---------- FEED: LISTA DE VIDEOS ----------
export function Feed(props) {
  const [videos, setVideos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Se ejecuta al abrir la pantalla y cada vez que cambia "recargar"
  useEffect(function() {
    // Pedimos los videos ordenados del mas nuevo al mas viejo
    const consulta = query(collection(db, "videos"), orderBy("fecha", "desc"));
    getDocs(consulta).then(function(resultado) {
      const lista = [];
      resultado.forEach(function(documento) {
        const video = documento.data();
        video.id = documento.id;
        lista.push(video);
      });
      setVideos(lista);
      setCargando(false);
    });
  }, [props.recargar]);

  return (
    <div>
      <h3>Feed</h3>
      {cargando && <p>Cargando videos...</p>}
      {!cargando && videos.length == 0 && <p>Todavía no hay videos</p>}
      {videos.map(function(video) {
        return <VideoTarjeta key={video.id} video={video} usuario={props.usuario} />;
      })}
    </div>
  );
}