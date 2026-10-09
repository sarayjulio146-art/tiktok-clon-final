import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";
import { SubirVideo, Feed } from "./videos";
import { Buscar, Perfil } from "./perfil";

// ---------- PANTALLA DE REGISTRO ----------
function Registro(props) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [mensaje, setMensaje] = useState("");

  function crearCuenta() {
    // Revisamos que no haya campos vacios
    if (nombre == "" || correo == "" || clave == "") {
      setMensaje("Llena todos los campos");
      return;
    }

    // 1. Firebase crea la cuenta con correo y clave
    createUserWithEmailAndPassword(auth, correo, clave)
      .then(function(resultado) {
        const uid = resultado.user.uid;
        const datos = { nombre: nombre, correo: correo, descripcion: "", foto: "" };

        // 2. Guardamos el perfil en la coleccion "usuarios", con el uid como id
        return setDoc(doc(db, "usuarios", uid), datos).then(function() {
          datos.id = uid;
          props.alTerminar(datos);
        });
      })
      .catch(function(error) {
        if (error.code == "auth/email-already-in-use") {
          setMensaje("Ese correo ya esta registrado");
        } else if (error.code == "auth/weak-password") {
          setMensaje("La clave debe tener minimo 6 caracteres");
        } else if (error.code == "auth/invalid-email") {
          setMensaje("El correo no es valido");
        } else {
          setMensaje("Error: " + error.message);
        }
      });
  }

  return (
    <div>
      <h2>Crear cuenta</h2>
      <input
        placeholder="Nombre de usuario"
        value={nombre}
        onChange={function(evento) { setNombre(evento.target.value); }}
      />
      <input
        placeholder="Correo"
        value={correo}
        onChange={function(evento) { setCorreo(evento.target.value); }}
      />
      <input
        type="password"
        placeholder="Clave (minimo 6 caracteres)"
        value={clave}
        onChange={function(evento) { setClave(evento.target.value); }}
      />
      <button onClick={crearCuenta}>Registrarme</button>
      <p>{mensaje}</p>
      <button onClick={props.irALogin}>Ya tengo cuenta</button>
    </div>
  );
}

// ---------- PANTALLA DE INICIO DE SESION ----------
function Login(props) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [mensaje, setMensaje] = useState("");

  function iniciarSesion() {
    // Firebase revisa si el correo y la clave son correctos
    signInWithEmailAndPassword(auth, correo, clave)
      .catch(function() {
        setMensaje("Correo o clave incorrectos");
      });
    // Si sale bien, App se entera sola (usa onAuthStateChanged)
  }

  return (
    <div>
      <h2>Iniciar sesión</h2>
      <input
        placeholder="Correo"
        value={correo}
        onChange={function(evento) { setCorreo(evento.target.value); }}
      />
      <input
        type="password"
        placeholder="Clave"
        value={clave}
        onChange={function(evento) { setClave(evento.target.value); }}
      />
      <button onClick={iniciarSesion}>Entrar</button>
      <p>{mensaje}</p>
      <button onClick={props.irARegistro}>Crear cuenta</button>
    </div>
  );
}

// ---------- APP PRINCIPAL ----------
function App() {
  // usuario: quien inicio sesion (null si nadie). pantalla: login o registro
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pantalla, setPantalla] = useState("login");
  const [recargar, setRecargar] = useState(0);
  // vista: que parte de la app se muestra (inicio, buscar o perfil)
  const [vista, setVista] = useState("inicio");
  const [perfilId, setPerfilId] = useState("");

  // Firebase avisa cada vez que alguien entra o sale (tambien al refrescar la pagina)
  useEffect(function() {
    const cancelar = onAuthStateChanged(auth, function(usuarioFirebase) {
      if (usuarioFirebase) {
        // Buscamos el perfil guardado en la coleccion "usuarios"
        getDoc(doc(db, "usuarios", usuarioFirebase.uid)).then(function(documento) {
          if (documento.exists()) {
            const datos = documento.data();
            datos.id = usuarioFirebase.uid;
            setUsuario(datos);
          }
          setCargando(false);
        });
      } else {
        setUsuario(null);
        setCargando(false);
      }
    });
    return cancelar;
  }, []);

  // Cierra la sesion
  function salir() {
    signOut(auth).then(function() {
      setUsuario(null);
      setPantalla("login");
      setVista("inicio");
    });
  }

  // Abre el perfil de una persona
  function abrirPerfil(id) {
    setPerfilId(id);
    setVista("perfil");
  }

  // Mientras Firebase revisa si hay sesion, mostramos un aviso
  if (cargando) {
    return <p>Cargando...</p>;
  }

  // Si hay usuario, mostramos la app con su menu
  if (usuario) {
    return (
      <div>
        <h2>Hola, {usuario.nombre}</h2>
        <div className="menu">
  <button onClick={function() { setVista("inicio"); }}>Inicio</button>
  <button onClick={function() { setVista("buscar"); }}>Buscar</button>
  <button onClick={function() { abrirPerfil(usuario.id); }}>Mi perfil</button>
  <button onClick={salir}>Cerrar sesión</button>
</div>

        {vista == "inicio" &&
          <div>
            <SubirVideo
              usuario={usuario}
              alPublicar={function() { setRecargar(recargar + 1); }}
            />
            <Feed recargar={recargar} usuario={usuario} />
          </div>
        }

        {vista == "buscar" &&
          <Buscar alAbrirPerfil={abrirPerfil} />
        }

        {vista == "perfil" &&
          <Perfil
            perfilId={perfilId}
            usuario={usuario}
            alActualizar={function(datos) { setUsuario(datos); }}
          />
        }
      </div>
    );
  }

  // Si no hay usuario, mostramos registro o login
  if (pantalla == "registro") {
    return (
      <Registro
        alTerminar={function(datos) { setUsuario(datos); }}
        irALogin={function() { setPantalla("login"); }}
      />
    );
  }

  return (
    <Login
      irARegistro={function() { setPantalla("registro"); }}
    />
  );
}

export default App;
