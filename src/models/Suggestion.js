const mongoose = require('mongoose');

// Chaque document = une sélection hebdomadaire d'un utilisateur
// Max 3 films par semaine (dimanche 00:00 → samedi 23:59)
// Règle d'ajout : on peut ajouter mardi ET mercredi matin seulement
const suggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Semaine ISO : ex "2025-W23" pour identifier la semaine courante
  weekKey: {
    type: String,
    required: true,
  },

  // Les films suggérés (1 à 3 max)
  films: [{
    userFilmId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserFilm' },
    tmdbId:     { type: Number, required: true },
    title:      { type: String, required: true },
    year:       { type: String },
    posterPath: { type: String, default: '' },
    rating:     { type: Number, min: 1, max: 5 },
    section:    {
      type: String,
      enum: ['chefdoeuvre', 'elite', 'bien', 'moyen', 'decu', 'navet'],
    },
    addedAt:    { type: Date, default: Date.now },
  }],

}, { timestamps: true });

// Un user = une seule sélection par semaine
suggestionSchema.index({ userId: 1, weekKey: 1 }, { unique: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);