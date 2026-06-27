const ActorRating = require('../models/Actorrating');

// ── PUT /api/actors/rate ──────────────────────────────────────────────────────
// Crée ou met à jour le rating d'un acteur pour l'utilisateur connecté.
// Si hearts === 0, on supprime le rating (désapprobation).
exports.rateActor = async (req, res) => {
  try {
    const { actorName, actorImg, hearts } = req.body;

    if (!actorName)
      return res.status(400).json({ message: 'actorName requis' });

    // hearts === 0 → supprime le rating
    if (hearts === 0) {
      await ActorRating.findOneAndDelete({ userId: req.userId, actorName });
      return res.json({ success: true, deleted: true });
    }

    if (!hearts || hearts < 1 || hearts > 4)
      return res.status(400).json({ message: 'hearts doit être entre 1 et 4 (ou 0 pour supprimer)' });

    const rating = await ActorRating.findOneAndUpdate(
      { userId: req.userId, actorName },
      { $set: { actorImg: actorImg || '', hearts } },
      { upsert: true, new: true }
    );

    res.json({ success: true, rating });
  } catch (err) {
    console.error('rateActor error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET /api/actors/my ────────────────────────────────────────────────────────
// Retourne tous les ratings d'acteurs de l'utilisateur connecté.
exports.getMyActorRatings = async (req, res) => {
  try {
    const ratings = await ActorRating.find({ userId: req.userId }).sort({ hearts: -1, updatedAt: -1 });
    res.json({ ratings });
  } catch (err) {
    console.error('getMyActorRatings error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET /api/actors/gold ──────────────────────────────────────────────────────
// Retourne uniquement les acteurs avec hearts === 4 (Gold).
// Utilisé par le Dashboard pour la card "Acteurs Gold".
exports.getGoldActors = async (req, res) => {
  try {
    const gold = await ActorRating.find({ userId: req.userId, hearts: 4 }).sort({ updatedAt: -1 });
    res.json({ actors: gold });
  } catch (err) {
    console.error('getGoldActors error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};