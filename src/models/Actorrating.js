const mongoose = require('mongoose');

// Un rating d'acteur est OPTIONNEL et propre à chaque user.
// On l'identifie par le nom de l'acteur (tmdbActorId si dispo, sinon actorName).
// Le rating est de 1 à 4 (4 cœurs).
const actorRatingSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Identifiants de l'acteur (du modèle Film)
  actorName: { type: String, required: true },
  actorImg:  { type: String, default: '' },        // profilePath complet (ex: "/abc.jpg")

  // Rating : 1 à 4 cœurs
  // 1 = intéressant, 2 = bien, 3 = très bien, 4 = Gold (cœur or)
  hearts:    { type: Number, min: 1, max: 4, required: true },

}, { timestamps: true });

// Un user ne peut avoir qu'un seul rating par acteur (par nom)
actorRatingSchema.index({ userId: 1, actorName: 1 }, { unique: true });

module.exports = mongoose.model('ActorRating', actorRatingSchema);