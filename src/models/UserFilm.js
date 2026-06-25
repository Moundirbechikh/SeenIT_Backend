const mongoose = require('mongoose');

// Ce modèle stocke UNIQUEMENT les données propres à chaque user.
// Toutes les infos du film viennent du modèle Film via tmdbId.
const userFilmSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filmId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Film', required: true },
  tmdbId:     { type: Number, required: true },   // dénormalisé pour requêtes rapides

  // Critique personnelle
  rating:     { type: Number, min: 1, max: 5, required: true },
  section:    { type: String, enum: ['elite', 'moyen', 'navet'], required: true },
  comment:    { type: String, default: '' },

  // Flags
  isFavorite: { type: Boolean, default: false },
  isHeart:    { type: Boolean, default: false },

  // Journal (plusieurs avis dans le temps)
  journal: [{
    text: String,
    date: { type: Date, default: Date.now },
  }],

  watchedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

// Index composé : un user ne peut avoir qu'un seul enregistrement par film
userFilmSchema.index({ userId: 1, tmdbId: 1 }, { unique: true });

module.exports = mongoose.model('UserFilm', userFilmSchema);