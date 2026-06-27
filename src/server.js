require("dotenv").config();
const express          = require("express");
const cors             = require('cors');
const connectDB        = require("./db");
const authRoutes       = require('./routes/authRoutes');
const actorRoutes      = require('./routes/Actorroutes');
const filmRoutes       = require('./routes/filmRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes'); // ← NOUVEAU

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Le serveur SeenIt est bien lancé !"));

app.use('/api/auth',        authRoutes);
app.use('/api/films',       filmRoutes);
app.use('/api/actors',      actorRoutes);
app.use('/api/suggestions', suggestionRoutes); // ← NOUVEAU

// ── CRON JOB : Reset hebdomadaire des suggestions ────────────────────────────
// MongoDB Atlas → crée un "Scheduled Trigger" avec le schedule suivant :
//   Cron : 0 0 * * 0   (chaque dimanche à 00:00 UTC)
//   Function :
//
//   exports = async function() {
//     const Suggestion = context.services.get("mongodb-atlas")
//       .db("seenit").collection("suggestions");
//     // On ne supprime PAS les anciennes suggestions, elles restent en archive.
//     // Le weekKey suffit à isoler chaque semaine.
//     // Rien à faire ici : le weekKey change automatiquement chaque dimanche.
//     console.log("SeenIt weekly reset — new weekKey active");
//   };
//
// Alternative sans Atlas : node-cron local (npm install node-cron)
// ─────────────────────────────────────────────────────────────────
// Décommente le bloc ci-dessous si tu utilises node-cron en local :
//
// const cron = require('node-cron');
// // Chaque dimanche à 00:00
// cron.schedule('0 0 * * 0', () => {
//   console.log('[Cron] Nouvelle semaine SeenIt — suggestions reset automatique via weekKey');
//   // Aucune suppression nécessaire : le weekKey gère l'isolation par semaine
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur en écoute sur le port ${PORT}`));