require("dotenv").config();
const express   = require("express");
const cors      = require('cors');
const connectDB = require("./db");
const authRoutes = require('./routes/authRoutes');
const filmRoutes = require('./routes/filmRoutes');  // ← NOUVEAU
const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Le serveur SeenIt est bien lancé !"));

app.use('/api/auth',  authRoutes);
app.use('/api/films', filmRoutes);  // ← NOUVEAU

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur en écoute sur le port ${PORT}`));