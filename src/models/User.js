// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:  { type: String, required: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String }, // Rendu optionnel pour l'inscription via Google
  theme:     { type: String, default: 'dark' },
  iconique:  { type: Boolean, default: false }, // Nouvelle valeur booléenne par défaut
  googleId:  { type: String }, // Pour identifier les comptes Google
  lastSeen:  { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);