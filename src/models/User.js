const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  theme:     { type: String, default: 'dark' },          // thème sauvegardé
  lastSeen:  { type: Date,   default: Date.now },         // pour l'expiration 7j
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);