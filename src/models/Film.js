const mongoose = require('mongoose');

// Ce modèle stocke les données TMDB une seule fois pour tous les users.
// Si le film existe déjà, on ne le re-télécharge pas.
const filmSchema = new mongoose.Schema({
  tmdbId:      { type: Number, required: true, unique: true },
  title:       { type: String, required: true },
  year:        { type: String },
  overview:    { type: String, default: '' },
  posterPath:  { type: String, default: '' },   // ex: "/abc123.jpg"
  genres:      [{ id: Number, name: String }],
  voteAverage: { type: Number, default: 0 },
  actors:      [{
    name:       String,
    character:  String,
    profilePath: String,
  }],
  director:    { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Film', filmSchema);